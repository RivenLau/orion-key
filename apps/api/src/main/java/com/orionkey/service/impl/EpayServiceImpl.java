package com.orionkey.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.constant.ErrorCode;
import com.orionkey.exception.BusinessException;
import com.orionkey.service.EpayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class EpayServiceImpl implements EpayService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public EpayResult createPayment(ChannelConfig config, String outTradeNo, String type, String name, BigDecimal money, String clientIp, String device) {
        // 动态拼接 return_url：基础 URL + orderId，使 epay 回跳到对应支付页
        String baseReturnUrl = config.returnUrl();
        String dynamicReturnUrl = baseReturnUrl + (baseReturnUrl.endsWith("/") ? "" : "/") + outTradeNo;

        Map<String, String> params = new LinkedHashMap<>();
        params.put("pid", config.pid());
        params.put("type", type);
        params.put("out_trade_no", outTradeNo);
        params.put("notify_url", config.notifyUrl());
        params.put("return_url", dynamicReturnUrl);
        params.put("name", name);
        params.put("money", money.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString());
        params.put("clientip", clientIp != null ? clientIp : "127.0.0.1");
        params.put("device", device != null && !device.isBlank() ? device : "pc");

        String sign = buildSign(config.key(), params);
        params.put("sign", sign);
        params.put("sign_type", "MD5");

        log.info("Epay createPayment: outTradeNo={}, type={}, money={}, apiUrl={}", outTradeNo, type, money, config.apiUrl());

        // Build form-urlencoded body
        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        params.forEach(formData::add);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(formData, headers);

        String url = config.apiUrl() + (config.apiUrl().endsWith("/") ? "" : "/") + "mapi.php";

        // 带重试的网络调用（最多重试 2 次，间隔 1 秒）
        int maxRetries = 2;
        Exception lastException = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    log.info("Epay API retry attempt {}/{}", attempt, maxRetries);
                    Thread.sleep(1000);
                }

                ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
                String responseBody = response.getBody();

                if (responseBody == null || responseBody.isBlank()) {
                    log.error("Epay API returned null/empty body");
                    throw new BusinessException(ErrorCode.WEBHOOK_VERIFY_FAIL, "支付创建失败：响应为空");
                }

                log.debug("Epay API raw response: {}", responseBody);

                Map<String, Object> body;
                try {
                    body = objectMapper.readValue(responseBody, new TypeReference<>() {});
                } catch (Exception parseEx) {
                    log.error("Epay API response is not valid JSON: {}", responseBody);
                    throw new BusinessException(ErrorCode.WEBHOOK_VERIFY_FAIL, "支付创建失败：响应格式异常");
                }

                int code = body.get("code") instanceof Number n ? n.intValue() : -1;
                String msg = body.get("msg") != null ? body.get("msg").toString() : "";
                String tradeNo = body.get("trade_no") != null ? body.get("trade_no").toString() : "";
                String payUrl = body.get("payurl") != null ? body.get("payurl").toString() : null;
                String qrcode = body.get("qrcode") != null ? body.get("qrcode").toString() : null;
                String urlscheme = body.get("urlscheme") != null ? body.get("urlscheme").toString() : null;

                log.info("Epay API response: code={}, msg={}, tradeNo={}, payUrl={}, qrcode={}", code, msg, tradeNo, payUrl, qrcode);

                if (code != 1) {
                    // 业务错误不重试
                    log.error("Epay API error: code={}, msg={}", code, msg);
                    throw new BusinessException(ErrorCode.WEBHOOK_VERIFY_FAIL, "支付创建失败：" + msg);
                }

                String resultQrcode = qrcode != null ? qrcode : urlscheme;

                // 网关未返回 payUrl 且为移动端请求时，将 qrcode（收银台页面 URL）作为 H5 跳转入口
                String effectivePayUrl = payUrl;
                if (effectivePayUrl == null && device != null && !"pc".equals(device) && resultQrcode != null) {
                    effectivePayUrl = resultQrcode;
                    log.info("Epay: gateway returned no payUrl, using qrcode URL as mobile redirect: {}", effectivePayUrl);
                }

                return new EpayResult(code, msg, tradeNo, effectivePayUrl, resultQrcode);

            } catch (BusinessException e) {
                throw e; // 业务异常直接抛出，不重试
            } catch (Exception e) {
                lastException = e;
                log.warn("Epay API attempt {} failed: {}", attempt + 1, e.getMessage());
            }
        }

        log.error("Epay API call failed after {} retries", maxRetries + 1, lastException);
        throw new BusinessException(ErrorCode.WEBHOOK_VERIFY_FAIL, "支付创建失败：网络超时，请重试");
    }

    @Override
    public String buildSign(String merchantKey, Map<String, String> params) {
        // 1. Filter out sign, sign_type, and empty values
        TreeMap<String, String> sorted = new TreeMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if ("sign".equals(key) || "sign_type".equals(key)) continue;
            if (value == null || value.isEmpty()) continue;
            sorted.put(key, value);
        }

        // 2. Concatenate sorted params: a=b&c=d&e=f
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : sorted.entrySet()) {
            if (!sb.isEmpty()) sb.append('&');
            sb.append(entry.getKey()).append('=').append(entry.getValue());
        }

        // 3. Append merchant key directly
        sb.append(merchantKey);

        // 4. MD5 hash
        return md5(sb.toString());
    }

    @Override
    public boolean verifySign(String merchantKey, Map<String, String> params, String sign) {
        if (sign == null || sign.isEmpty()) return false;
        String expected = buildSign(merchantKey, params);
        return expected.equalsIgnoreCase(sign);
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
}
