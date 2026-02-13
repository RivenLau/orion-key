package com.orionkey.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.common.ApiResponse;
import com.orionkey.constant.ErrorCode;
import com.orionkey.repository.SiteConfigRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(2)
@RequiredArgsConstructor
public class RateLimitFilter implements Filter {

    private final SiteConfigRepository siteConfigRepository;
    private final ObjectMapper objectMapper;

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    // Cache: rate limit config, refresh every 60s
    private volatile int cachedRateLimit = 20;
    private volatile long cacheExpiry = 0;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        // Skip admin and static resources
        if (path.startsWith("/api/admin") || path.startsWith("/api/uploads")) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(httpRequest);
        int rateLimit = getRateLimit();

        TokenBucket bucket = buckets.computeIfAbsent(clientIp, k -> new TokenBucket(rateLimit));
        if (!bucket.tryConsume()) {
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            httpResponse.setStatus(429);
            httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
            httpResponse.setCharacterEncoding("UTF-8");
            httpResponse.getWriter().write(objectMapper.writeValueAsString(
                    ApiResponse.error(ErrorCode.TOO_MANY_REQUESTS, "请求过于频繁，请稍后再试")));
            return;
        }

        chain.doFilter(request, response);

        // Periodic cleanup
        if (buckets.size() > 10000) {
            long now = System.currentTimeMillis();
            buckets.entrySet().removeIf(e -> now - e.getValue().lastAccess > 60000);
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(xff)) {
            // Take the first IP (client's real IP)
            return xff.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
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
        private long tokens;
        private long lastRefill;
        volatile long lastAccess;

        TokenBucket(int capacity) {
            this.capacity = capacity;
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
            if (elapsed >= 1000) {
                long tokensToAdd = elapsed / 1000 * capacity;
                tokens = Math.min(capacity, tokens + tokensToAdd);
                lastRefill = now;
            }
        }
    }
}
