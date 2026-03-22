package com.orionkey.config;

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
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 设备指纹限流 Filter。
 * <p>
 * 以前端传递的 X-Device-Id 为维度进行滑动窗口限流。
 * X-Device-Id 缺失或格式异常时降级为 IP 限流（不拒绝请求）。
 * <p>
 * 开关：site_configs 表中 device_rate_limit_enabled（默认 true）。
 */
@Slf4j
@Component
@Order(5)
@RequiredArgsConstructor
public class DeviceRateLimitFilter implements Filter {

    private final SiteConfigRepository siteConfigRepository;
    private final ObjectMapper objectMapper;

    private static final String DEVICE_ID_HEADER = "X-Device-Id";

    /** 合法 deviceId 格式：64 位十六进制（SHA-256 输出） */
    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");

    /** TXID 路径提取 orderId：/api/orders/{orderId}/txid-verify */
    private static final Pattern TXID_PATH_PATTERN = Pattern.compile("^/api/orders/([^/]+)/txid-verify$");

    /** 受信代理 IP 列表 */
    @Value("${rate-limit.trusted-proxies:127.0.0.1,::1,0:0:0:0:0:0:0:1}")
    private String trustedProxiesConfig;
    private volatile Set<String> trustedProxies;

    // ── 限流桶存储 ──
    private final Map<String, SlidingWindowCounter> deviceBuckets = new ConcurrentHashMap<>();
    /** TXID per-order 限流桶（key: orderId） */
    private final Map<String, SlidingWindowCounter> txidOrderBuckets = new ConcurrentHashMap<>();

    // ── 配置缓存 ──
    private volatile boolean cachedEnabled = true;
    private volatile int orderLimit = 10;
    private volatile int txidDeviceLimit = 5;
    private volatile int txidOrderLimit = 3;
    private volatile int queryLimit = 20;
    private volatile int loginLimit = 10;
    private volatile int registerLimit = 5;
    private volatile long configCacheExpiry = 0;

    /** 限流类别 */
    private enum Category {
        ORDER, TXID, QUERY, LOGIN, REGISTER, NONE
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();
        String method = httpRequest.getMethod();

        Category category = classify(path, method);
        if (category == Category.NONE) {
            chain.doFilter(request, response);
            return;
        }

        // 检查开关
        refreshConfig();
        if (!cachedEnabled) {
            chain.doFilter(request, response);
            return;
        }

        // 解析限流 key（优先 deviceId，降级为 IP）
        String rateLimitKey = resolveRateLimitKey(httpRequest);

        // TXID per-order 限流（独立于设备限流）
        if (category == Category.TXID) {
            Matcher m = TXID_PATH_PATTERN.matcher(path);
            if (m.matches()) {
                String orderId = m.group(1);
                String orderKey = "txid_order:" + orderId;
                SlidingWindowCounter orderCounter = txidOrderBuckets.computeIfAbsent(
                        orderKey, k -> new SlidingWindowCounter(86400_000L)); // 24 小时窗口
                if (!orderCounter.tryIncrement(txidOrderLimit)) {
                    log.info("TXID per-order rate limit hit: orderId={}", orderId);
                    reject(response);
                    return;
                }
            }
        }

        // 设备/IP 维度限流
        int limit = switch (category) {
            case ORDER -> orderLimit;
            case TXID -> txidDeviceLimit;
            case QUERY -> queryLimit;
            case LOGIN -> loginLimit;
            case REGISTER -> registerLimit;
            default -> 20;
        };

        String bucketKey = "device:" + rateLimitKey + ":" + category.name();
        SlidingWindowCounter counter = deviceBuckets.computeIfAbsent(
                bucketKey, k -> new SlidingWindowCounter(3600_000L)); // 1 小时窗口

        if (!counter.tryIncrement(limit)) {
            log.info("Device rate limit hit: category={}, key={}, path={}", category, rateLimitKey, path);
            reject(response);
            return;
        }

        chain.doFilter(request, response);

        // 定期清理
        long now = System.currentTimeMillis();
        if (deviceBuckets.size() > 10000) {
            deviceBuckets.entrySet().removeIf(e -> now - e.getValue().lastAccess > 3600_000L);
        }
        if (txidOrderBuckets.size() > 5000) {
            txidOrderBuckets.entrySet().removeIf(e -> now - e.getValue().lastAccess > 86400_000L);
        }
    }

    private Category classify(String path, String method) {
        if (!"POST".equalsIgnoreCase(method) && !"GET".equalsIgnoreCase(method)) {
            return Category.NONE;
        }

        // POST 精确匹配
        if ("POST".equalsIgnoreCase(method)) {
            if ("/api/orders".equals(path) || "/api/orders/from-cart".equals(path)) {
                return Category.ORDER;
            }
            if ("/api/orders/query".equals(path) || "/api/orders/deliver".equals(path)) {
                return Category.QUERY;
            }
            if ("/api/auth/login".equals(path)) {
                return Category.LOGIN;
            }
            if ("/api/auth/register".equals(path)) {
                return Category.REGISTER;
            }
            // POST 动态路径
            if (TXID_PATH_PATTERN.matcher(path).matches()) {
                return Category.TXID;
            }
        }

        // GET 动态路径：export
        if ("GET".equalsIgnoreCase(method) && path.matches("^/api/orders/[^/]+/export$")) {
            return Category.QUERY;
        }

        return Category.NONE;
    }

    private String resolveRateLimitKey(HttpServletRequest request) {
        String deviceId = request.getHeader(DEVICE_ID_HEADER);
        if (StringUtils.hasText(deviceId) && DEVICE_ID_PATTERN.matcher(deviceId).matches()) {
            return deviceId;
        }
        // 降级为 IP
        return resolveClientIp(request);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (getTrustedProxies().contains(remoteAddr)) {
            String realIp = request.getHeader("X-Real-IP");
            if (StringUtils.hasText(realIp)) {
                return realIp.trim();
            }
        }
        return remoteAddr;
    }

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

    private void refreshConfig() {
        long now = System.currentTimeMillis();
        if (now > configCacheExpiry) {
            try {
                cachedEnabled = getConfigBool("device_rate_limit_enabled", true);
                orderLimit = getConfigInt("device_order_limit_per_hour", 10);
                txidDeviceLimit = getConfigInt("device_txid_limit_per_hour", 5);
                txidOrderLimit = getConfigInt("txid_submit_limit_per_order", 3);
                queryLimit = getConfigInt("device_query_limit_per_hour", 20);
                loginLimit = getConfigInt("device_login_limit_per_hour", 10);
                registerLimit = getConfigInt("device_register_limit_per_hour", 5);
            } catch (Exception e) {
                // DB 不可用时使用缓存值
            }
            configCacheExpiry = now + 60_000;
        }
    }

    private int getConfigInt(String key, int defaultValue) {
        return siteConfigRepository.findByConfigKey(key)
                .map(c -> {
                    try { return Integer.parseInt(c.getConfigValue()); }
                    catch (Exception e) { return defaultValue; }
                }).orElse(defaultValue);
    }

    private boolean getConfigBool(String key, boolean defaultValue) {
        return siteConfigRepository.findByConfigKey(key)
                .map(c -> !"false".equalsIgnoreCase(c.getConfigValue()))
                .orElse(defaultValue);
    }

    private void reject(ServletResponse response) throws IOException {
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        httpResponse.setStatus(429);
        httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
        httpResponse.setCharacterEncoding("UTF-8");
        httpResponse.getWriter().write(objectMapper.writeValueAsString(
                ApiResponse.error(ErrorCode.DEVICE_RATE_LIMITED, "操作过于频繁，请稍后再试")));
    }

    @Override
    public void init(FilterConfig filterConfig) {
        log.info("Device rate limit filter initialized");
    }

    /**
     * 滑动窗口计数器。
     * 在 windowMs 时间窗口内计数请求次数，超过 limit 则拒绝。
     */
    private static class SlidingWindowCounter {
        private final long windowMs;
        private long windowStart;
        private int count;
        volatile long lastAccess;

        SlidingWindowCounter(long windowMs) {
            this.windowMs = windowMs;
            this.windowStart = System.currentTimeMillis();
            this.count = 0;
            this.lastAccess = System.currentTimeMillis();
        }

        synchronized boolean tryIncrement(int limit) {
            long now = System.currentTimeMillis();
            lastAccess = now;

            // 窗口已过期，重置
            if (now - windowStart >= windowMs) {
                windowStart = now;
                count = 0;
            }

            if (count >= limit) {
                return false;
            }
            count++;
            return true;
        }
    }
}
