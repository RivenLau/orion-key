package com.orionkey.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Webhook 端点来源限制过滤器。
 * <p>
 * 支持两种白名单方式（可同时配置，取并集）：
 * <ul>
 *   <li>{@code webhook.allowed-ips} — 静态 IP 白名单（逗号分隔）</li>
 *   <li>{@code webhook.allowed-domains} — 域名白名单（逗号分隔），自动 DNS 解析，5 分钟刷新缓存</li>
 * </ul>
 * 两者均未配置时不启用限制。
 */
@Slf4j
@Component
@Order(1)  // 优先于 RateLimitFilter
public class WebhookIpFilter implements Filter {

    @Value("${webhook.allowed-ips:}")
    private String allowedIpsConfig;

    @Value("${webhook.allowed-domains:}")
    private String allowedDomainsConfig;

    /** 与 RateLimitFilter 共用受信代理列表，确保 Nginx 反代后能正确解析来源 IP */
    @Value("${rate-limit.trusted-proxies:127.0.0.1,::1,0:0:0:0:0:0:0:1}")
    private String trustedProxiesConfig;

    private volatile Set<String> staticIps;
    private volatile Set<String> trustedProxies;
    private volatile Set<String> resolvedDomainIps;
    private volatile long domainCacheExpiry = 0;

    /** DNS 缓存有效期：5 分钟 */
    private static final long DNS_CACHE_TTL_MS = 300_000;

    private Set<String> getStaticIps() {
        if (staticIps == null) {
            Set<String> set = ConcurrentHashMap.newKeySet();
            if (allowedIpsConfig != null && !allowedIpsConfig.isBlank()) {
                for (String ip : allowedIpsConfig.split(",")) {
                    String trimmed = ip.trim();
                    if (!trimmed.isEmpty()) set.add(trimmed);
                }
            }
            staticIps = set;
        }
        return staticIps;
    }

    private Set<String> getResolvedDomainIps() {
        long now = System.currentTimeMillis();
        if (resolvedDomainIps == null || now > domainCacheExpiry) {
            Set<String> ips = ConcurrentHashMap.newKeySet();
            if (allowedDomainsConfig != null && !allowedDomainsConfig.isBlank()) {
                for (String domain : allowedDomainsConfig.split(",")) {
                    String trimmed = domain.trim();
                    if (trimmed.isEmpty()) continue;
                    try {
                        InetAddress[] addresses = InetAddress.getAllByName(trimmed);
                        for (InetAddress addr : addresses) {
                            ips.add(addr.getHostAddress());
                        }
                    } catch (UnknownHostException e) {
                        log.warn("Webhook allowed domain DNS resolve failed: {}", trimmed);
                    }
                }
            }
            resolvedDomainIps = ips;
            domainCacheExpiry = now + DNS_CACHE_TTL_MS;
            if (!ips.isEmpty()) {
                log.debug("Webhook domain IPs resolved: {}", ips);
            }
        }
        return resolvedDomainIps;
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

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        // 仅拦截 webhook 路径
        if (path.startsWith("/api/payments/webhook")) {
            Set<String> ips = getStaticIps();
            Set<String> domainIps = getResolvedDomainIps();
            boolean filterEnabled = !ips.isEmpty() || !domainIps.isEmpty();

            if (filterEnabled) {
                String clientIp = resolveClientIp(httpRequest);
                if (!ips.contains(clientIp) && !domainIps.contains(clientIp)) {
                    log.warn("Webhook request blocked: IP {} not in whitelist, path={}", clientIp, path);
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

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // 启动时立即初始化并打印状态，方便确认配置是否生效
        Set<String> ips = getStaticIps();
        Set<String> domainIps = getResolvedDomainIps();
        if (!ips.isEmpty() || !domainIps.isEmpty()) {
            log.info("Webhook IP filter enabled — static IPs: {}, domains resolved IPs: {}", ips, domainIps);
        } else {
            log.info("Webhook IP filter disabled (no allowed-ips or allowed-domains configured)");
        }
    }

    /**
     * 解析客户端真实 IP。
     * 生产环境经 Nginx 反代后 getRemoteAddr() 返回 Nginx IP（如 127.0.0.1），
     * 需从 X-Forwarded-For / X-Real-IP 中获取支付网关的真实来源 IP。
     */
    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();

        if (getTrustedProxies().contains(remoteAddr)) {
            String xff = request.getHeader("X-Forwarded-For");
            if (StringUtils.hasText(xff)) {
                return xff.split(",")[0].trim();
            }
            String realIp = request.getHeader("X-Real-IP");
            if (StringUtils.hasText(realIp)) {
                return realIp.trim();
            }
        }

        return remoteAddr;
    }
}
