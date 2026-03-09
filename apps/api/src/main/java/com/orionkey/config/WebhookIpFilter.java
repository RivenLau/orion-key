package com.orionkey.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Webhook 端点 IP 白名单过滤器。
 * 配置 webhook.allowed-ips 后，仅允许白名单中的 IP 访问 /api/payments/webhook/**。
 * 未配置或为空时不启用白名单限制。
 */
@Slf4j
@Component
@Order(1)  // 优先于 RateLimitFilter
public class WebhookIpFilter implements Filter {

    @Value("${webhook.allowed-ips:}")
    private String allowedIpsConfig;

    private volatile Set<String> allowedIps;
    private volatile boolean enabled = false;

    private Set<String> getAllowedIps() {
        if (allowedIps == null) {
            Set<String> set = ConcurrentHashMap.newKeySet();
            if (allowedIpsConfig != null && !allowedIpsConfig.isBlank()) {
                for (String ip : allowedIpsConfig.split(",")) {
                    String trimmed = ip.trim();
                    if (!trimmed.isEmpty()) set.add(trimmed);
                }
            }
            allowedIps = set;
            enabled = !set.isEmpty();
            if (enabled) {
                log.info("Webhook IP whitelist enabled: {}", set);
            }
        }
        return allowedIps;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        // 仅拦截 webhook 路径
        if (path.startsWith("/api/payments/webhook")) {
            Set<String> ips = getAllowedIps();
            if (enabled) {
                String remoteAddr = httpRequest.getRemoteAddr();
                if (!ips.contains(remoteAddr)) {
                    log.warn("Webhook request blocked: IP {} not in whitelist, path={}", remoteAddr, path);
                    HttpServletResponse httpResponse = (HttpServletResponse) response;
                    httpResponse.setStatus(403);
                    httpResponse.setContentType(MediaType.TEXT_PLAIN_VALUE);
                    httpResponse.getWriter().write("Forbidden");
                    return;
                }
            }
        }

        chain.doFilter(request, response);
    }
}
