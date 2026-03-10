package com.orionkey.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.common.ApiResponse;
import com.orionkey.constant.ErrorCode;
import com.orionkey.repository.SiteConfigRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(2)
@RequiredArgsConstructor
public class RateLimitFilter implements Filter {

    private final SiteConfigRepository siteConfigRepository;
    private final ObjectMapper objectMapper;

    /** 通用限流桶 */
    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    /** 登录端点独立限流桶（更严格） */
    private final Map<String, TokenBucket> loginBuckets = new ConcurrentHashMap<>();

    /** 受信代理 IP 列表（只有来自受信代理的请求才读取 X-Forwarded-For） */
    @Value("${rate-limit.trusted-proxies:127.0.0.1,::1,0:0:0:0:0:0:0:1}")
    private String trustedProxiesConfig;

    private volatile Set<String> trustedProxies;

    // Cache: rate limit config, refresh every 60s
    private volatile int cachedRateLimit = 20;
    private volatile long cacheExpiry = 0;

    /** 登录端点限制：每分钟 5 次 */
    private static final int LOGIN_RATE_PER_MINUTE = 5;

    /** 敏感端点路径 */
    private static final Set<String> LOGIN_PATHS = Set.of(
            "/api/auth/login", "/api/auth/register"
    );

    private Set<String> getTrustedProxies() {
        if (trustedProxies == null) {
            Set<String> set = ConcurrentHashMap.newKeySet();
            if (trustedProxiesConfig != null) {
                for (String ip : trustedProxiesConfig.split(",")) {
                    String trimmed = ip.trim();
                    if (!trimmed.isEmpty()) set.add(trimmed);
                }
            }
            trustedProxies = set;
        }
        return trustedProxies;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        // F21: 仅跳过静态资源（上传文件服务），admin 端点纳入限流（防止暴力攻击）
        if (path.startsWith("/api/uploads")) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(httpRequest);

        // 登录/注册端点：独立的更严格限流（每分钟 LOGIN_RATE_PER_MINUTE 次）
        if (LOGIN_PATHS.contains(path)) {
            String loginKey = "login:" + clientIp;
            TokenBucket loginBucket = loginBuckets.computeIfAbsent(loginKey,
                    k -> new TokenBucket(LOGIN_RATE_PER_MINUTE, 60_000));
            if (!loginBucket.tryConsume()) {
                rejectTooManyRequests(response, "登录请求过于频繁，请稍后再试");
                return;
            }
        }

        // 通用限流
        int rateLimit = getRateLimit();
        TokenBucket bucket = buckets.computeIfAbsent(clientIp, k -> new TokenBucket(rateLimit));
        if (!bucket.tryConsume()) {
            rejectTooManyRequests(response, "请求过于频繁，请稍后再试");
            return;
        }

        chain.doFilter(request, response);

        // Periodic cleanup
        long now = System.currentTimeMillis();
        if (buckets.size() > 10000) {
            buckets.entrySet().removeIf(e -> now - e.getValue().lastAccess > 60_000);
        }
        if (loginBuckets.size() > 5000) {
            loginBuckets.entrySet().removeIf(e -> now - e.getValue().lastAccess > 120_000);
        }
    }

    private void rejectTooManyRequests(ServletResponse response, String message) throws IOException {
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        httpResponse.setStatus(429);
        httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
        httpResponse.setCharacterEncoding("UTF-8");
        httpResponse.getWriter().write(objectMapper.writeValueAsString(
                ApiResponse.error(ErrorCode.TOO_MANY_REQUESTS, message)));
    }

    /**
     * 解析客户端真实 IP。
     * 仅当直连 IP 在受信代理列表中时，才读取代理头。
     * 优先使用 X-Real-IP（Nginx 用 $remote_addr 覆写，客户端无法伪造），
     * X-Forwarded-For 的首项可被客户端注入，不适合用于安全决策。
     */
    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();

        if (getTrustedProxies().contains(remoteAddr)) {
            String realIp = request.getHeader("X-Real-IP");
            if (StringUtils.hasText(realIp)) {
                return realIp.trim();
            }
            String xff = request.getHeader("X-Forwarded-For");
            if (StringUtils.hasText(xff)) {
                String[] parts = xff.split(",");
                for (int i = parts.length - 1; i >= 0; i--) {
                    String ip = parts[i].trim();
                    if (!ip.isEmpty() && !getTrustedProxies().contains(ip)) {
                        return ip;
                    }
                }
                return parts[0].trim();
            }
        }

        return remoteAddr;
    }

    private int getRateLimit() {
        long now = System.currentTimeMillis();
        if (now > cacheExpiry) {
            try {
                cachedRateLimit = siteConfigRepository.findByConfigKey("rate_limit_per_second")
                        .map(c -> {
                            try { return Integer.parseInt(c.getConfigValue()); }
                            catch (Exception e) { return 20; }
                        }).orElse(20);
            } catch (Exception e) {
                // DB unavailable, use cached value
            }
            cacheExpiry = now + 60_000; // 60s TTL
        }
        return cachedRateLimit;
    }

    private static class TokenBucket {
        private final int capacity;
        private final long refillIntervalMs;
        private long tokens;
        private long lastRefill;
        volatile long lastAccess;

        /** 默认：每秒补满 */
        TokenBucket(int capacity) {
            this(capacity, 1000);
        }

        /** 自定义补充间隔（毫秒） */
        TokenBucket(int capacity, long refillIntervalMs) {
            this.capacity = capacity;
            this.refillIntervalMs = refillIntervalMs;
            this.tokens = capacity;
            this.lastRefill = System.currentTimeMillis();
            this.lastAccess = System.currentTimeMillis();
        }

        synchronized boolean tryConsume() {
            refill();
            lastAccess = System.currentTimeMillis();
            if (tokens > 0) {
                tokens--;
                return true;
            }
            return false;
        }

        private void refill() {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRefill;
            if (elapsed >= refillIntervalMs) {
                long intervals = elapsed / refillIntervalMs;
                long tokensToAdd = intervals * capacity;
                tokens = Math.min(capacity, tokens + tokensToAdd);
                lastRefill = now;
            }
        }
    }
}
