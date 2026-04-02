package com.orionkey.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.common.ApiResponse;
import com.orionkey.constant.ErrorCode;
import com.orionkey.repository.SiteConfigRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

/**
 * Cloudflare Turnstile 人机验证 Filter。
 * <p>
 * 对配置的敏感路径拦截请求，从 Header 中提取 Turnstile token，
 * 调用 Cloudflare siteverify API 验证。验证失败返回 400。
 * <p>
 * 开关：site_configs 表中 turnstile_enabled（默认 false，需在后台手动启用）。
 * Cloudflare API 不可用时降级放行（WARN 日志）。
 */
@Slf4j
@Component
@Order(4)
@RequiredArgsConstructor
public class TurnstileFilter implements Filter {

    private final SiteConfigRepository siteConfigRepository;
    private final ObjectMapper objectMapper;

    @Value("${turnstile.secret-key:}")
    private String secretKey;

    private static final String TOKEN_HEADER = "X-Turnstile-Token";
    private static final String SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    private static final int TIMEOUT_MS = 3000;

    /**
     * Turnstile 保护的路径（一次性高风险操作）。
     * <p>
     * 订单查询/TXID 提交不在此列：它们是同一页面可重复触发的"查看"操作，
     * Cloudflare token 单次消费特性会导致连续操作失败。
     * 这些路径已有设备指纹限流（query: 20次/h, txid: 5次/h + 3次/24h/订单）保护。
     */
    private static final Set<String> EXACT_PATHS = Set.of(
            "/api/orders",
            "/api/orders/from-cart",
            "/api/auth/login",
            "/api/auth/register"
    );

    /** 开关配置缓存（60 秒刷新） */
    private volatile boolean cachedEnabled = true;
    private volatile long enabledCacheExpiry = 0;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();
        String method = httpRequest.getMethod();

        // 仅拦截匹配的敏感路径
        if (!shouldVerify(path, method)) {
            chain.doFilter(request, response);
            return;
        }

        // 检查开关
        if (!isEnabled()) {
            chain.doFilter(request, response);
            return;
        }

        // Secret Key 未配置 → 降级放行
        if (secretKey == null || secretKey.isBlank()) {
            log.warn("Turnstile secret key not configured, skipping verification for path={}", path);
            chain.doFilter(request, response);
            return;
        }

        // 提取 token
        String token = httpRequest.getHeader(TOKEN_HEADER);
        if (token == null || token.isBlank()) {
            log.info("Turnstile token missing: path={}, ip={}", path, httpRequest.getRemoteAddr());
            reject(response, "人机验证失败，请刷新页面后重试");
            return;
        }

        // 调用 Cloudflare siteverify
        boolean verified = verifySiteverify(token, httpRequest.getRemoteAddr());
        if (!verified) {
            log.info("Turnstile verification failed: path={}, ip={}", path, httpRequest.getRemoteAddr());
            reject(response, "人机验证失败，请刷新页面后重试");
            return;
        }

        chain.doFilter(request, response);
    }

    private boolean shouldVerify(String path, String method) {
        if (!"POST".equalsIgnoreCase(method)) {
            return false;
        }
        return EXACT_PATHS.contains(path);
    }

    private static RestTemplate createTurnstileRestTemplate() {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(java.time.Duration.ofMillis(TIMEOUT_MS));
        factory.setReadTimeout(java.time.Duration.ofMillis(TIMEOUT_MS));
        return new RestTemplate(factory);
    }
    private final RestTemplate turnstileRestTemplate = createTurnstileRestTemplate();

    private boolean verifySiteverify(String token, String remoteIp) {
        try {
            // Cloudflare siteverify 要求 application/x-www-form-urlencoded 格式
            org.springframework.util.MultiValueMap<String, String> formData = new org.springframework.util.LinkedMultiValueMap<>();
            formData.add("secret", secretKey);
            formData.add("response", token);
            if (remoteIp != null && !remoteIp.isBlank()) {
                formData.add("remoteip", remoteIp);
            }

            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED);
            org.springframework.http.HttpEntity<org.springframework.util.MultiValueMap<String, String>> request =
                    new org.springframework.http.HttpEntity<>(formData, headers);

            String responseBody = turnstileRestTemplate.postForObject(SITEVERIFY_URL, request, String.class);
            if (responseBody == null) {
                log.warn("Turnstile siteverify returned null, degrading to allow");
                return true;
            }

            Map<String, Object> result = objectMapper.readValue(responseBody, new TypeReference<>() {});
            Boolean success = (Boolean) result.get("success");
            if (!Boolean.TRUE.equals(success)) {
                log.debug("Turnstile siteverify response: {}", responseBody);
                return false;
            }
            return true;
        } catch (Exception e) {
            // Cloudflare API 不可用 → 降级放行
            log.warn("Turnstile siteverify call failed (degrading to allow): {}", e.getMessage());
            return true;
        }
    }

    private boolean isEnabled() {
        long now = System.currentTimeMillis();
        if (now > enabledCacheExpiry) {
            try {
                cachedEnabled = siteConfigRepository.findByConfigKey("turnstile_enabled")
                        .map(c -> !"false".equalsIgnoreCase(c.getConfigValue()))
                        .orElse(false);
            } catch (Exception e) {
                // DB 不可用时使用缓存值
            }
            enabledCacheExpiry = now + 60_000;
        }
        return cachedEnabled;
    }

    private void reject(ServletResponse response, String message) throws IOException {
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        httpResponse.setStatus(400);
        httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
        httpResponse.setCharacterEncoding("UTF-8");
        httpResponse.getWriter().write(objectMapper.writeValueAsString(
                ApiResponse.error(ErrorCode.TURNSTILE_FAILED, message)));
    }

    @Override
    public void init(FilterConfig filterConfig) {
        if (secretKey == null || secretKey.isBlank()) {
            log.info("Turnstile filter initialized — secret key NOT configured (will skip verification)");
        } else {
            log.info("Turnstile filter initialized — secret key configured, ready");
        }
    }
}
