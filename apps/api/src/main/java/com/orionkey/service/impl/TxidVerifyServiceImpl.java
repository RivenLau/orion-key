package com.orionkey.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.constant.ErrorCode;
import com.orionkey.constant.OrderStatus;
import com.orionkey.entity.Order;
import com.orionkey.entity.PaymentChannel;
import com.orionkey.entity.UnmatchedTransaction;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.PaymentChannelRepository;
import com.orionkey.repository.UnmatchedTransactionRepository;
import com.orionkey.service.BepusdtService;
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
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class TxidVerifyServiceImpl implements TxidVerifyService {

    private final OrderRepository orderRepository;
    private final PaymentChannelRepository paymentChannelRepository;
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

    @Override
    @Transactional
    public VerifyDetail verifyAndProcess(Order order, String txid) {
        String chain = order.getUsdtChain();
        BepusdtService.BepusdtConfig config = loadConfig(order);

        // ---- Step 1: 调用链上 API 查询交易 ----
        ChainTransaction tx;
        try {
            tx = queryTransaction(chain, txid);
        } catch (Exception e) {
            log.error("链上 API 查询失败: chain={}, txid={}, error={}", chain, txid, e.getMessage());
            saveUnmatched(order, txid, chain, VerifyResult.PENDING_REVIEW,
                    "链上 API 查询失败，转人工审核", null, null, null);
            return new VerifyDetail(VerifyResult.PENDING_REVIEW,
                    "查询链上交易超时，已转人工处理", null, null, null, false);
        }

        // ---- Step 2: 交易是否存在且已确认 ----
        if (tx == null || !tx.confirmed) {
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_REJECTED,
                    "交易不存在或未确认", null, null, null);
            return new VerifyDetail(VerifyResult.AUTO_REJECTED,
                    "交易不存在或尚未被区块链确认",
                    tx != null ? tx.from : null, tx != null ? tx.to : null,
                    tx != null ? tx.amount : null, false);
        }

        // ---- Step 3: 收款地址是否匹配我方钱包 ----
        if (!tx.to.equalsIgnoreCase(order.getUsdtWalletAddress())) {
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_REJECTED,
                    "收款地址不匹配", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.AUTO_REJECTED,
                    "该交易的收款地址与订单不匹配", tx.from, tx.to, tx.amount, true);
        }

        // ---- Step 4: Token 合约是否为 USDT ----
        // F5: 必须校验 contractAddress 非 null — 否则原生代币（TRX/BNB）转账会绕过此检查
        if (tx.contractAddress == null || !USDT_CONTRACTS.contains(tx.contractAddress.toLowerCase())) {
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_REJECTED,
                    "非 USDT 交易", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.AUTO_REJECTED,
                    "该交易转账的不是 USDT", tx.from, tx.to, tx.amount, true);
        }

        // ---- Step 5: 金额差异判定 ----
        BigDecimal expected = new BigDecimal(order.getUsdtCryptoAmount());
        BigDecimal actual = new BigDecimal(tx.amount);
        BigDecimal diff = expected.subtract(actual).abs();

        if (diff.compareTo(config.autoApproveTolerance()) <= 0) {
            // 差额 ≤ 容差阈值 → 自动通过
            order.setStatus(OrderStatus.PAID);
            order.setPaidAt(LocalDateTime.now());
            order.setUsdtTxId(txid);
            orderRepository.save(order);
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_APPROVED,
                    "自动通过，差额 " + diff.toPlainString() + " USDT", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.AUTO_APPROVED,
                    "支付已确认", tx.from, tx.to, tx.amount, true);
        }

        if (diff.compareTo(config.manualReviewUpper()) > 0) {
            // 差额 > 人工审核上限 → 自动拒绝
            saveUnmatched(order, txid, chain, VerifyResult.AUTO_REJECTED,
                    "金额差异过大: " + diff.toPlainString() + " USDT", tx.from, tx.to, tx.amount);
            return new VerifyDetail(VerifyResult.AUTO_REJECTED,
                    "转账金额与订单金额相差 " + diff.toPlainString() + " USDT，超出允许范围",
                    tx.from, tx.to, tx.amount, true);
        }

        // 差额在 (容差, 上限] 之间 → 转人工
        saveUnmatched(order, txid, chain, VerifyResult.PENDING_REVIEW,
                "金额差异 " + diff.toPlainString() + " USDT，需人工确认", tx.from, tx.to, tx.amount);
        return new VerifyDetail(VerifyResult.PENDING_REVIEW,
                "转账金额与订单存在差异，已提交人工审核", tx.from, tx.to, tx.amount, true);
    }

    /**
     * 链上交易信息
     */
    private record ChainTransaction(
            String from,
            String to,
            String amount,
            String contractAddress,
            boolean confirmed
    ) {}

    /**
     * 查询链上交易
     */
    private ChainTransaction queryTransaction(String chain, String txid) {
        if (chain != null && chain.contains("trc20")) {
            return queryTronTransaction(txid);
        } else if (chain != null && chain.contains("bep20")) {
            return queryBscTransaction(txid);
        }
        throw new BusinessException(ErrorCode.TXID_VERIFY_FAILED, "不支持的链类型: " + chain);
    }

    /**
     * 通过 TronGrid API 查询 TRC20 交易
     */
    private ChainTransaction queryTronTransaction(String txid) {
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

                // F6: 通过 walletsolidity API 验证交易是否已 solidified（不可逆确认），不再硬编码 true
                boolean confirmed = checkTronTransactionConfirmed(txid);
                return new ChainTransaction(from, to, amount.toPlainString(), contractAddress, confirmed);
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

            // 解析 Transfer 事件日志
            // Transfer(address indexed from, address indexed to, uint256 value)
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> logs = (List<Map<String, Object>>) receipt.get("logs");
            if (logs == null || logs.isEmpty()) {
                return new ChainTransaction(null, null, "0", null, confirmed);
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

                return new ChainTransaction(from, to, amount.toPlainString(), contractAddress, confirmed);
            }

            return new ChainTransaction(null, null, "0", null, confirmed);
        } catch (Exception e) {
            log.error("Failed to parse BSC RPC response: {}", e.getMessage());
            throw new RuntimeException("BSC RPC 解析失败", e);
        }
    }

    @Override
    public ChainVerifyResult verifyForWebhook(String chain, String txid,
                                               String expectedWalletAddress, String expectedCryptoAmount) {
        ChainTransaction tx;
        try {
            tx = queryTransaction(chain, txid);
        } catch (Exception e) {
            log.warn("Webhook on-chain query failed: chain={}, txid={}, error={}", chain, txid, e.getMessage());
            return null; // 查询失败 → 调用方应触发重试
        }

        // 1. 交易是否存在
        if (tx == null) {
            return new ChainVerifyResult(false, "交易不存在");
        }

        // 2. 交易是否已达到不可逆确认
        // TRC20 需 19 个区块确认（solidification ≈ 57s），BEpusdt 可能在 1-3 个确认时就发送回调。
        // 此时交易真实存在但尚未 solidified — 返回 null 触发 BEpusdt 重试，等待后续区块确认。
        if (!tx.confirmed()) {
            log.info("Webhook on-chain: transaction exists but not yet confirmed (solidified), deferring: txid={}", txid);
            return null;
        }

        // 3. 收款地址是否匹配
        if (tx.to() == null || !tx.to().equalsIgnoreCase(expectedWalletAddress)) {
            return new ChainVerifyResult(false,
                    "收款地址不匹配: expected=" + expectedWalletAddress + ", actual=" + tx.to());
        }

        // 4. Token 合约是否为 USDT
        if (tx.contractAddress() == null || !USDT_CONTRACTS.contains(tx.contractAddress().toLowerCase())) {
            return new ChainVerifyResult(false, "非 USDT 合约交易");
        }

        // 5. 金额是否匹配（容差 0.001 USDT 防止链上精度差异）
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
     * 从订单的支付渠道加载 BepusdtConfig
     */
    private BepusdtService.BepusdtConfig loadConfig(Order order) {
        PaymentChannel channel = paymentChannelRepository
                .findByChannelCodeAndIsDeleted(order.getPaymentMethod(), 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "支付渠道不存在"));

        Map<String, String> cfg = parseConfigData(channel.getConfigData());

        // F7: 默认容差从 1.5 降至 0.01 USDT — 防止攻击者系统性少付
        BigDecimal tolerance = new BigDecimal(cfg.getOrDefault("auto_approve_tolerance", "0.01"));
        BigDecimal upper = new BigDecimal(cfg.getOrDefault("manual_review_upper", "5.0"));

        return new BepusdtService.BepusdtConfig(
                cfg.getOrDefault("api_url", ""),
                cfg.getOrDefault("api_token", ""),
                cfg.getOrDefault("notify_url", ""),
                cfg.getOrDefault("redirect_url", ""),
                cfg.getOrDefault("trade_type", "usdt.trc20"),
                cfg.getOrDefault("fiat", "CNY"),
                Integer.parseInt(cfg.getOrDefault("timeout", "900")),
                tolerance,
                upper,
                cfg.getOrDefault("fixed_rate", "")
        );
    }

    private Map<String, String> parseConfigData(String configData) {
        if (configData == null || configData.isBlank()) return Map.of();
        try {
            Map<String, Object> raw = objectMapper.readValue(configData, new TypeReference<>() {});
            java.util.LinkedHashMap<String, String> result = new java.util.LinkedHashMap<>();
            for (var entry : raw.entrySet()) {
                if (entry.getValue() != null) {
                    result.put(entry.getKey(), entry.getValue().toString());
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Failed to parse channel config_data: {}", e.getMessage());
            return Map.of();
        }
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
