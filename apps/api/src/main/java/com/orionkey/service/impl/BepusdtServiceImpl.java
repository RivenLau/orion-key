package com.orionkey.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.constant.ErrorCode;
import com.orionkey.exception.BusinessException;
import com.orionkey.service.BepusdtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.TreeMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class BepusdtServiceImpl implements BepusdtService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public BepusdtPaymentResult createPayment(BepusdtConfig config, String orderId, BigDecimal amount, String productName) {
        // 用 String map 计算签名（签名算法基于字符串值）
        Map<String, String> signParams = new TreeMap<>();
        signParams.put("order_id", orderId);
        signParams.put("amount", amount.stripTrailingZeros().toPlainString());
        signParams.put("notify_url", config.notifyUrl());
        signParams.put("redirect_url", config.redirectUrl());
        signParams.put("trade_type", config.tradeType());
        signParams.put("fiat", config.fiat());
        signParams.put("name", productName);
        signParams.put("timeout", String.valueOf(config.timeout()));
        if (config.fixedRate() != null && !config.fixedRate().isBlank()) {
            signParams.put("rate", config.fixedRate());
        }

        String signature = buildSign(config.apiToken(), signParams);

        // 构建请求体：amount/timeout 必须为数字类型（BEpusdt Go 端要求 float64/int64）
        Map<String, Object> requestBody = new TreeMap<>(signParams);
        requestBody.put("amount", amount.doubleValue());
        requestBody.put("timeout", (long) config.timeout());
        requestBody.put("signature", signature);

        String url = config.apiUrl();
        if (!url.endsWith("/")) url += "/";
        url += "api/v1/order/create-transaction";

        log.info("BEpusdt createPayment: orderId={}, amount={}, tradeType={}, apiUrl={}",
                orderId, amount, config.tradeType(), config.apiUrl());

        // 带重试的网络调用（最多重试 2 次，间隔 1 秒）
        int maxRetries = 2;
        Exception lastException = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    log.info("BEpusdt API retry attempt {}/{}", attempt, maxRetries);
                    Thread.sleep(1000);
                }

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                String body = objectMapper.writeValueAsString(requestBody);
                HttpEntity<String> request = new HttpEntity<>(body, headers);

                ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
                String responseBody = response.getBody();

                if (responseBody == null || responseBody.isBlank()) {
                    log.error("BEpusdt API returned null/empty body");
                    throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "USDT 支付创建失败：响应为空");
                }

                log.debug("BEpusdt API raw response: {}", responseBody);

                Map<String, Object> result;
                try {
                    result = objectMapper.readValue(responseBody, new TypeReference<>() {});
                } catch (Exception parseEx) {
                    log.error("BEpusdt API response is not valid JSON: {}", responseBody);
                    throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "USDT 支付创建失败：响应格式异常");
                }

                // BEpusdt 返回 status_code: 200 表示成功
                Object statusCode = result.get("status_code");
                int code = statusCode instanceof Number n ? n.intValue() : -1;
                String msg = result.get("message") != null ? result.get("message").toString() : "";

                if (code != 200) {
                    log.error("BEpusdt API error: status_code={}, message={}", code, msg);
                    throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "USDT 支付创建失败：" + msg);
                }

                // 解析 data 字段
                @SuppressWarnings("unchecked")
                Map<String, Object> data = (Map<String, Object>) result.get("data");
                if (data == null) {
                    throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "USDT 支付创建失败：响应缺少 data");
                }

                String tradeId = getString(data, "trade_id");
                String walletAddress = getString(data, "token");
                String cryptoAmount = getString(data, "actual_amount");
                String paymentUrl = getString(data, "payment_url");
                int expirationTime = data.get("expiration_time") instanceof Number n
                        ? n.intValue() : config.timeout();

                log.info("BEpusdt payment created: tradeId={}, wallet={}, amount={}, paymentUrl={}",
                        tradeId, walletAddress, cryptoAmount, paymentUrl);

                return new BepusdtPaymentResult(tradeId, walletAddress, cryptoAmount, paymentUrl, expirationTime);

            } catch (BusinessException e) {
                throw e; // 业务异常直接抛出，不重试
            } catch (Exception e) {
                lastException = e;
                log.warn("BEpusdt API attempt {} failed: {}", attempt + 1, e.getMessage());
            }
        }

        log.error("BEpusdt API call failed after {} retries", maxRetries + 1, lastException);
        throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "USDT 支付创建失败：网络超时，请重试");
    }

    /**
     * BEpusdt 签名算法（兼容易支付签名协议）：
     * 1. 取所有非空参数（排除 signature）
     * 2. 按 key 字母序排序
     * 3. 拼接 key1=value1&key2=value2&...
     * 4. 末尾直接拼接 apiToken（无 & 分隔符）
     * 5. MD5 哈希，小写
     */
    @Override
    public String buildSign(String apiToken, Map<String, String> params) {
        TreeMap<String, String> sorted = new TreeMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if ("signature".equals(key) || "sign".equals(key) || "sign_type".equals(key)) continue;
            if (value == null || value.isEmpty()) continue;
            sorted.put(key, value);
        }

        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : sorted.entrySet()) {
            if (!sb.isEmpty()) sb.append('&');
            sb.append(entry.getKey()).append('=').append(entry.getValue());
        }

        // 末尾直接拼接 apiToken（无 & 分隔符）
        sb.append(apiToken);

        return md5(sb.toString());
    }

    @Override
    public boolean verifySign(String apiToken, Map<String, String> params, String signature) {
        if (signature == null || signature.isEmpty()) return false;
        String expected = buildSign(apiToken, params);
        return expected.equalsIgnoreCase(signature);
    }

    private String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 algorithm not available", e);
        }
    }

    private static String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : "";
    }
}
