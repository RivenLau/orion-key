package com.orionkey.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.constant.ErrorCode;
import com.orionkey.constant.OrderStatus;
import com.orionkey.entity.Order;
import com.orionkey.entity.UnmatchedTransaction;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.UnmatchedTransactionRepository;
import com.orionkey.service.TxidVerifyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class TxidVerifyServiceImpl implements TxidVerifyService {

    private final OrderRepository orderRepository;
    private final UnmatchedTransactionRepository unmatchedTransactionRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /**
     * TRC20 USDT 合约地址
     */
    private static final String TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

    /**
     * BEP20 USDT 合约地址（BSC）
     */
    private static final String BSC_USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

    /**
     * 已知 USDT 合约地址集合（小写）
     */
    private static final Set<String> USDT_CONTRACTS = Set.of(
            TRON_USDT_CONTRACT.toLowerCase(),
            BSC_USDT_CONTRACT.toLowerCase()
    );

    /**
     * 交易时间校验缓冲（秒）：链上交易时间必须 ≥ 订单创建时间 - 此缓冲值。
     * 正常流程中用户必须先拿到钱包地址才能转账，交易一定在订单之后；
     * 120 秒缓冲用于应对服务器与区块链节点之间的时钟偏差（NTP 同步后通常 < 1 秒），
     * 以及纵深防御"先看到链上交易再创建订单提交 TXID"的攻击路径。
     * 主防线为 Step 6 的精确金额匹配，时间校验为辅助层。
     */
    private static final long TX_TIME_BUFFER_SECONDS = 120;

    @Override
    @Transactional
    public VerifyDetail verifyAndProcess(Order order, String txid) {
        String chain = order.getUsdtChain();

        // ---- Step 1: 调用链上 API 查询交易 ----
        ChainTransaction tx;
        try {
            tx = queryTransaction(chain, txid);
        } catch (Exception e) {
            log.error("链上 API 查询失败: chain={}, txid={}, error={}", chain, txid, e.getMessage());
            saveUnmatched(order, txid, chain, VerifyResult.PENDING_REVIEW,
                    "CHAIN_API_ERROR", null, null, null);
            return new VerifyDetail(VerifyResult.PENDING_REVIEW,
                    "CHAIN_API_ERROR", null, null, null, false);
        }

        // ---- Step 2: 交易是否存在且已确认 ----
        if (tx == null || !tx.confirmed) {
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_REJECTED,
                    "TX_NOT_FOUND_OR_UNCONFIRMED", null, null, null);
            return new VerifyDetail(VerifyResult.AUTO_REJECTED,
                    "TX_NOT_FOUND_OR_UNCONFIRMED",
                    tx != null ? tx.from : null, tx != null ? tx.to : null,
                    tx != null ? tx.amount : null, false);
        }

        // ---- Step 3: 收款地址是否匹配我方钱包 ----
        if (!tx.to.equalsIgnoreCase(order.getUsdtWalletAddress())) {
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_REJECTED,
                    "ADDRESS_MISMATCH", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.AUTO_REJECTED,
                    "ADDRESS_MISMATCH", tx.from, tx.to, tx.amount, true);
        }

        // ---- Step 4: Token 合约是否为 USDT ----
        // F5: 必须校验 contractAddress 非 null — 否则原生代币（TRX/BNB）转账会绕过此检查
        if (tx.contractAddress == null || !USDT_CONTRACTS.contains(tx.contractAddress.toLowerCase())) {
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_REJECTED,
                    "NOT_USDT", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.AUTO_REJECTED,
                    "NOT_USDT", tx.from, tx.to, tx.amount, true);
        }

        // ---- Step 5: 交易时间校验（防止历史交易 TXID 重放攻击） ----
        if (tx.blockTimestamp == null) {
            // 无法获取区块时间戳 → fail-safe 转人工审核，不自动通过
            log.warn("TXID verify: block timestamp unavailable, txid={}, orderId={}", txid, order.getId());
            saveUnmatched(order, txid, chain, VerifyResult.PENDING_REVIEW,
                    "BLOCK_TIME_UNAVAILABLE", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.PENDING_REVIEW,
                    "BLOCK_TIME_UNAVAILABLE", tx.from, tx.to, tx.amount, true);
        }
        long orderCreatedEpoch = order.getCreatedAt()
                .atZone(ZoneId.systemDefault())
                .toEpochSecond();
        if (tx.blockTimestamp < orderCreatedEpoch - TX_TIME_BUFFER_SECONDS) {
            log.warn("TXID verify: transaction too old, txid={}, txTime={}, orderCreated={}, orderId={}",
                    txid, tx.blockTimestamp, orderCreatedEpoch, order.getId());
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_REJECTED,
                    "TX_TOO_OLD", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.AUTO_REJECTED,
                    "TX_TOO_OLD", tx.from, tx.to, tx.amount, true);
        }

        // ---- Step 6: 金额判定（仅精确匹配自动通过，任何差异转人工审核） ----
        // 安全设计：BEpusdt 使用 2 位小数顺序递增分配金额（如 45.44, 45.45），
        // 容差式自动通过会被攻击者利用相邻金额的 TXID 盗刷。
        // 因此仅精确匹配（diff=0）才自动通过，任何金额不一致均转人工审核。
        BigDecimal expected = new BigDecimal(order.getUsdtCryptoAmount());
        BigDecimal actual = new BigDecimal(tx.amount);
        BigDecimal diff = expected.subtract(actual).abs();

        if (diff.compareTo(BigDecimal.ZERO) == 0) {
            // 精确匹配 → 自动通过，TXID UNIQUE 约束兜底防并发
            order.setStatus(OrderStatus.PAID);
            order.setPaidAt(LocalDateTime.now());
            order.setUsdtTxId(txid);
            try {
                orderRepository.saveAndFlush(order);
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                // TXID 已被 webhook 或其他请求抢先写入（UNIQUE 约束冲突）
                // flush 失败后 Hibernate Session 不一致，不能正常 return（Spring 的 commit 会抛异常），
                // 必须抛出 RuntimeException 让 @Transactional 走回滚路径，由 GlobalExceptionHandler 返回业务错误。
                log.warn("TXID verify: unique constraint violation (webhook race), txid={}, orderId={}", txid, order.getId());
                throw new BusinessException(ErrorCode.TXID_ALREADY_USED, "该交易哈希已被其他订单使用");
            }
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_APPROVED,
                    "AUTO_APPROVED", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.AUTO_APPROVED,
                    "AUTO_APPROVED", tx.from, tx.to, tx.amount, true);
        }

        // 金额不匹配 → 统一转人工审核（覆盖手续费少付、输入误差等场景）
        saveUnmatched(order, txid, chain, VerifyResult.PENDING_REVIEW,
                "AMOUNT_MISMATCH:" + diff.toPlainString(), tx.from, tx.to, tx.amount);
        return new VerifyDetail(VerifyResult.PENDING_REVIEW,
                "AMOUNT_MISMATCH:" + diff.toPlainString(), tx.from, tx.to, tx.amount, true);
    }

    /**
     * 链上交易信息
     */
    private record ChainTransaction(
            String from,
            String to,
            String amount,
            String contractAddress,
            boolean confirmed,
            Long blockTimestamp   // 区块时间戳（秒级 Unix timestamp），null 表示获取失败
    ) {}

    /**
     * 查询链上交易
     */
    private ChainTransaction queryTransaction(String chain, String txid) {
        return queryTransaction(chain, txid, true);
    }

    private ChainTransaction queryTransaction(String chain, String txid, boolean requireSolidified) {
        if (chain != null && chain.contains("trc20")) {
            return queryTronTransaction(txid, requireSolidified);
        } else if (chain != null && chain.contains("bep20")) {
            return queryBscTransaction(txid);
        }
        throw new BusinessException(ErrorCode.TXID_VERIFY_FAILED, "不支持的链类型: " + chain);
    }

    /**
     * 通过 TronGrid API 查询 TRC20 交易
     */
    private ChainTransaction queryTronTransaction(String txid, boolean requireSolidified) {
        String url = "https://api.trongrid.io/v1/transactions/" + txid + "/events";
        log.info("Querying TronGrid: {}", url);

        String responseBody = restTemplate.getForObject(url, String.class);
        if (responseBody == null) return null;

        try {
            Map<String, Object> result = objectMapper.readValue(responseBody, new TypeReference<>() {});
            log.debug("TronGrid response: {}", responseBody);

            Boolean success = (Boolean) result.get("success");
            if (!Boolean.TRUE.equals(success)) return null;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> data = (List<Map<String, Object>>) result.get("data");
            if (data == null || data.isEmpty()) return null;

            // 查找 Transfer 事件
            for (Map<String, Object> event : data) {
                String eventName = (String) event.get("event_name");
                if (!"Transfer".equals(eventName)) continue;

                String contractAddress = (String) event.get("contract_address");
                @SuppressWarnings("unchecked")
                Map<String, Object> eventResult = (Map<String, Object>) event.get("result");
                if (eventResult == null) continue;

                String from = hexToTronBase58((String) eventResult.get("from"));
                String to = hexToTronBase58((String) eventResult.get("to"));
                Object valueObj = eventResult.get("value");
                String rawValue = valueObj != null ? valueObj.toString() : "0";

                // TRC20 USDT 精度为 6 位
                BigDecimal amount = new BigDecimal(rawValue).movePointLeft(6);

                // 提取区块时间戳（TronGrid 事件数据中已包含 block_timestamp，毫秒级）
                Long blockTimestamp = null;
                Object blockTsObj = event.get("block_timestamp");
                if (blockTsObj instanceof Number) {
                    blockTimestamp = ((Number) blockTsObj).longValue() / 1000; // 毫秒 → 秒
                }

                // 手动 TXID 验证：通过 walletsolidity API 验证交易是否已 solidified（不可逆确认）
                // Webhook 回调：跳过 solidification 检查（BEpusdt 自己扫链发现的交易，可信度高）
                boolean confirmed = !requireSolidified || checkTronTransactionConfirmed(txid);
                return new ChainTransaction(from, to, amount.toPlainString(), contractAddress, confirmed, blockTimestamp);
            }
            return null;
        } catch (Exception e) {
            log.error("Failed to parse TronGrid response: {}", e.getMessage());
            throw new RuntimeException("TronGrid API 解析失败", e);
        }
    }

    /**
     * 通过 TronGrid walletsolidity API 验证交易是否已达到不可逆确认状态。
     * walletsolidity 端点仅返回已 solidified（19 个区块确认）的交易信息。
     */
    private boolean checkTronTransactionConfirmed(String txid) {
        try {
            String url = "https://api.trongrid.io/walletsolidity/gettransactioninfobyid";
            Map<String, String> body = Map.of("value", txid);
            String response = restTemplate.postForObject(url, body, String.class);
            if (response == null || response.isBlank() || "{}".equals(response.trim())) {
                log.warn("TronGrid solidity: transaction not yet solidified, txid={}", txid);
                return false;
            }
            Map<String, Object> info = objectMapper.readValue(response, new TypeReference<>() {});
            // 如果无 id 字段，说明交易未被 solidified
            if (!info.containsKey("id")) return false;
            // 检查 receipt.result: "SUCCESS" 或 null/absent 均视为成功
            @SuppressWarnings("unchecked")
            Map<String, Object> receipt = (Map<String, Object>) info.get("receipt");
            if (receipt == null) return true; // 无 receipt 表示简单转账，视为成功
            String receiptResult = (String) receipt.get("result");
            return receiptResult == null || "SUCCESS".equals(receiptResult) || "DEFAULT".equals(receiptResult);
        } catch (Exception e) {
            log.warn("Failed to verify TronGrid transaction confirmation: txid={}, error={}", txid, e.getMessage());
            return false; // Fail-safe: 未确认则拒绝
        }
    }

    /**
     * 通过 BSC 公共 RPC 查询 BEP20 交易。
     * 使用 eth_getTransactionReceipt JSON-RPC 方法获取交易收据，
     * 从 logs 中解析 Transfer 事件提取 from/to/amount/contract。
     * 不依赖 BscScan REST API（已废弃 V1，V2 需付费）。
     */
    private ChainTransaction queryBscTransaction(String txid) {
        String rpcUrl = "https://bsc-dataseed.bnbchain.org/";
        log.info("Querying BSC RPC receipt: txid={}", txid);

        Map<String, Object> rpcRequest = Map.of(
                "jsonrpc", "2.0",
                "method", "eth_getTransactionReceipt",
                "params", List.of(txid),
                "id", 1
        );

        String responseBody = restTemplate.postForObject(rpcUrl, rpcRequest, String.class);
        if (responseBody == null) return null;

        try {
            Map<String, Object> rpcResponse = objectMapper.readValue(responseBody, new TypeReference<>() {});
            @SuppressWarnings("unchecked")
            Map<String, Object> receipt = (Map<String, Object>) rpcResponse.get("result");
            if (receipt == null) return null;

            String statusHex = (String) receipt.get("status");
            boolean confirmed = "0x1".equals(statusHex);

            // 通过 blockNumber 查询区块时间戳
            String blockNumberHex = (String) receipt.get("blockNumber");
            Long blockTimestamp = queryBscBlockTimestamp(rpcUrl, blockNumberHex);

            // 解析 Transfer 事件日志
            // Transfer(address indexed from, address indexed to, uint256 value)
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> logs = (List<Map<String, Object>>) receipt.get("logs");
            if (logs == null || logs.isEmpty()) {
                return new ChainTransaction(null, null, "0", null, confirmed, blockTimestamp);
            }

            String transferSig = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

            for (Map<String, Object> logEntry : logs) {
                @SuppressWarnings("unchecked")
                List<String> topics = (List<String>) logEntry.get("topics");
                if (topics == null || topics.size() < 3) continue;
                if (!transferSig.equals(topics.get(0))) continue;

                String contractAddress = (String) logEntry.get("address");
                // topics[1] = from（32 字节左填充，取后 40 位 hex）
                String from = "0x" + topics.get(1).substring(26);
                // topics[2] = to
                String to = "0x" + topics.get(2).substring(26);
                // data = value（uint256 hex）
                String data = (String) logEntry.get("data");
                BigInteger rawValue = new BigInteger(data.substring(2), 16);
                // BSC USDT (Binance-Peg BSC-USD) 精度为 18 位
                BigDecimal amount = new BigDecimal(rawValue).movePointLeft(18);

                return new ChainTransaction(from, to, amount.toPlainString(), contractAddress, confirmed, blockTimestamp);
            }

            return new ChainTransaction(null, null, "0", null, confirmed, blockTimestamp);
        } catch (Exception e) {
            log.error("Failed to parse BSC RPC response: {}", e.getMessage());
            throw new RuntimeException("BSC RPC 解析失败", e);
        }
    }

    /**
     * 通过 BSC RPC 查询区块时间戳。
     * eth_getBlockByNumber 返回区块头，其中 timestamp 为 hex 编码的秒级 Unix 时间戳。
     *
     * @param rpcUrl         BSC RPC 节点地址
     * @param blockNumberHex 区块号（hex，如 "0x541c1a1"）
     * @return 秒级 Unix 时间戳，查询失败返回 null
     */
    private Long queryBscBlockTimestamp(String rpcUrl, String blockNumberHex) {
        if (blockNumberHex == null) return null;
        try {
            Map<String, Object> blockRequest = Map.of(
                    "jsonrpc", "2.0",
                    "method", "eth_getBlockByNumber",
                    "params", List.of(blockNumberHex, false),  // false = 不返回交易详情，只要区块头
                    "id", 2
            );
            String blockResponse = restTemplate.postForObject(rpcUrl, blockRequest, String.class);
            if (blockResponse == null) return null;

            Map<String, Object> blockRpc = objectMapper.readValue(blockResponse, new TypeReference<>() {});
            @SuppressWarnings("unchecked")
            Map<String, Object> blockResult = (Map<String, Object>) blockRpc.get("result");
            if (blockResult == null) return null;

            String timestampHex = (String) blockResult.get("timestamp");
            if (timestampHex == null) return null;
            return Long.parseLong(timestampHex.substring(2), 16);
        } catch (Exception e) {
            log.warn("Failed to query BSC block timestamp: blockNumber={}, error={}", blockNumberHex, e.getMessage());
            return null;
        }
    }

    @Override
    public ChainVerifyResult verifyForWebhook(String chain, String txid,
                                               String expectedWalletAddress, String expectedCryptoAmount,
                                               LocalDateTime orderCreatedAt) {
        ChainTransaction tx;
        try {
            // Webhook 回调来自 BEpusdt 自身的链上扫描，可信度高，跳过 TRC20 solidification 检查
            tx = queryTransaction(chain, txid, false);
        } catch (Exception e) {
            log.warn("Webhook on-chain query failed: chain={}, txid={}, error={}", chain, txid, e.getMessage());
            return null; // 查询失败 → 调用方应触发重试
        }

        // 1. 交易是否存在
        if (tx == null) {
            return new ChainVerifyResult(false, "交易不存在");
        }

        // 2. 收款地址是否匹配
        if (tx.to() == null || !tx.to().equalsIgnoreCase(expectedWalletAddress)) {
            return new ChainVerifyResult(false,
                    "收款地址不匹配: expected=" + expectedWalletAddress + ", actual=" + tx.to());
        }

        // 3. Token 合约是否为 USDT
        if (tx.contractAddress() == null || !USDT_CONTRACTS.contains(tx.contractAddress().toLowerCase())) {
            return new ChainVerifyResult(false, "非 USDT 合约交易");
        }

        // 4. 交易时间校验（防止旧交易 TXID 重放，兜底防御）
        if (tx.blockTimestamp() == null) {
            log.warn("Webhook on-chain verify: block timestamp unavailable, txid={}", txid);
            return null; // 无法获取时间戳 → 触发 BEpusdt 重试
        }
        long orderCreatedEpoch = orderCreatedAt
                .atZone(ZoneId.systemDefault())
                .toEpochSecond();
        if (tx.blockTimestamp() < orderCreatedEpoch - TX_TIME_BUFFER_SECONDS) {
            return new ChainVerifyResult(false,
                    "交易时间早于订单创建: txTime=" + tx.blockTimestamp() + ", orderCreated=" + orderCreatedEpoch);
        }

        // 5. 金额是否匹配
        // 注意：此处 0.001 容差仅用于对齐 BEpusdt 回调金额与我们独立链上查询结果之间的浮点精度差异，
        // 不同于 verifyAndProcess 的精确匹配策略。Webhook 路径的主金额校验在 WebhookServiceImpl
        // 中已完成精确比对（compareTo != 0），此处为纵深防御的链上二次验证。
        try {
            BigDecimal expected = new BigDecimal(expectedCryptoAmount);
            BigDecimal actual = new BigDecimal(tx.amount());
            if (expected.subtract(actual).abs().compareTo(new BigDecimal("0.001")) > 0) {
                return new ChainVerifyResult(false,
                        "金额不匹配: expected=" + expectedCryptoAmount + ", actual=" + tx.amount());
            }
        } catch (NumberFormatException e) {
            return new ChainVerifyResult(false, "金额格式异常");
        }

        return new ChainVerifyResult(true, "链上验证通过");
    }

    /**
     * 保存审核记录到 unmatched_transactions 表
     */
    private void saveUnmatched(Order order, String txid, String chain,
                                VerifyResult result, String reason,
                                String from, String to, String amount) {
        UnmatchedTransaction ut = new UnmatchedTransaction();
        ut.setOrderId(order.getId());
        ut.setTxid(txid);
        ut.setChain(chain);
        ut.setOnChainFrom(from);
        ut.setOnChainTo(to);
        ut.setOnChainAmount(amount);
        ut.setExpectedAmount(order.getUsdtCryptoAmount());
        if (amount != null && order.getUsdtCryptoAmount() != null) {
            BigDecimal diff = new BigDecimal(order.getUsdtCryptoAmount())
                    .subtract(new BigDecimal(amount)).abs();
            ut.setAmountDiff(diff.toPlainString());
        }
        ut.setSource("USER_SUBMIT");
        ut.setStatus(result.name());
        ut.setVerifyReason(reason);
        ut.setSubmittedAt(LocalDateTime.now());
        unmatchedTransactionRepository.save(ut);
    }

    // ── Tron 地址格式转换工具 ──

    private static final String BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    /**
     * 将 TronGrid 事件返回的 hex 地址转换为 Tron Base58Check 地址。
     * TronGrid 事件 result 中的 from/to 为 20 字节 hex（如 0x0854...），
     * 而订单中存储的 Tron 钱包地址为 Base58Check 格式（如 TAjF...）。
     * 转换规则：Base58Check(0x41 + 20字节地址)
     */
    private String hexToTronBase58(String hexAddress) {
        if (hexAddress == null || hexAddress.isBlank()) return hexAddress;
        // 已经是 Base58 格式（T 开头）则直接返回
        if (hexAddress.startsWith("T")) return hexAddress;
        try {
            String hex = hexAddress.startsWith("0x") ? hexAddress.substring(2) : hexAddress;
            byte[] rawAddress = hexStringToBytes("41" + hex);
            // SHA-256 双重哈希取前 4 字节作为校验码
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] hash1 = sha256.digest(rawAddress);
            byte[] hash2 = sha256.digest(hash1);
            byte[] addressWithChecksum = new byte[rawAddress.length + 4];
            System.arraycopy(rawAddress, 0, addressWithChecksum, 0, rawAddress.length);
            System.arraycopy(hash2, 0, addressWithChecksum, rawAddress.length, 4);
            return base58Encode(addressWithChecksum);
        } catch (Exception e) {
            log.warn("Failed to convert hex to Tron Base58: {}, returning original", hexAddress);
            return hexAddress;
        }
    }

    private byte[] hexStringToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }

    private String base58Encode(byte[] input) {
        BigInteger value = new BigInteger(1, input);
        BigInteger base = BigInteger.valueOf(58);
        StringBuilder sb = new StringBuilder();
        while (value.compareTo(BigInteger.ZERO) > 0) {
            BigInteger[] divmod = value.divideAndRemainder(base);
            value = divmod[0];
            sb.append(BASE58_ALPHABET.charAt(divmod[1].intValue()));
        }
        // 前导零字节对应 Base58 的 '1'
        for (byte b : input) {
            if (b == 0) sb.append('1');
            else break;
        }
        return sb.reverse().toString();
    }
}
