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
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class MaintenanceFilter implements Filter {

    private final SiteConfigRepository siteConfigRepository;
    private final ObjectMapper objectMapper;

    // Cache: maintenance mode, refresh every 30s
    private volatile boolean cachedMaintenanceEnabled = false;
    private volatile String cachedMaintenanceMessage = "系统维护中，请稍后访问";
    private volatile long cacheExpiry = 0;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        // Skip admin endpoints and webhook
        if (path.startsWith("/api/admin") || path.startsWith("/api/payments/webhook")) {
            chain.doFilter(request, response);
            return;
        }

        try {
            refreshCache();
        } catch (Exception e) {
            log.warn("Failed to read maintenance config, using cached value", e);
        }

        if (cachedMaintenanceEnabled) {
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            httpResponse.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
            httpResponse.setCharacterEncoding("UTF-8");
            httpResponse.getWriter().write(objectMapper.writeValueAsString(
                    ApiResponse.error(ErrorCode.MAINTENANCE, cachedMaintenanceMessage)));
            return;
        }

        chain.doFilter(request, response);
    }

    private void refreshCache() {
        long now = System.currentTimeMillis();
        if (now > cacheExpiry) {
            cachedMaintenanceEnabled = siteConfigRepository.findByConfigKey("maintenance_enabled")
                    .map(c -> "true".equalsIgnoreCase(c.getConfigValue()))
                    .orElse(false);
            if (cachedMaintenanceEnabled) {
                cachedMaintenanceMessage = siteConfigRepository.findByConfigKey("maintenance_message")
                        .map(c -> c.getConfigValue())
                        .orElse("系统维护中，请稍后访问");
            }
            cacheExpiry = now + 30_000; // 30s TTL
        }
    }
}
