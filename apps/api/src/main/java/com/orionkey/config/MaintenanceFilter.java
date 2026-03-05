package com.orionkey.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.common.ApiResponse;
import com.orionkey.constant.ErrorCode;
import com.orionkey.repository.SiteConfigRepository;
import com.orionkey.utils.JwtUtils;
import io.jsonwebtoken.Claims;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class MaintenanceFilter implements Filter {

    private final SiteConfigRepository siteConfigRepository;
    private final ObjectMapper objectMapper;
    private final JwtUtils jwtUtils;

    // Cache: maintenance mode, refresh every 30s
    private volatile boolean cachedMaintenanceEnabled = false;
    private volatile String cachedMaintenanceMessage = "系统维护中，请稍后访问";
    private volatile long cacheExpiry = 0;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        // Skip endpoints required for maintenance mode to function correctly:
        // - /api/admin/*        : admin backend must remain accessible
        // - /api/payments/webhook: payment callbacks must not be blocked
        // - /api/site/config    : frontend needs real config to detect maintenance mode
        // - /api/auth/*         : login/token check needed so admin can log in and be identified
        // - /api/captcha/*      : login may require captcha verification
        if (path.startsWith("/api/admin")
                || path.startsWith("/api/payments/webhook")
                || path.equals("/api/site/config")
                || path.startsWith("/api/auth/")
                || path.startsWith("/api/captcha")) {
            chain.doFilter(request, response);
            return;
        }

        try {
            refreshCache();
        } catch (Exception e) {
            log.warn("Failed to read maintenance config, using cached value", e);
        }

        if (cachedMaintenanceEnabled) {
            // Allow requests from authenticated ADMIN users (full access during maintenance)
            if (isAdminRequest(httpRequest)) {
                chain.doFilter(request, response);
                return;
            }

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

    /**
     * Check if the request carries a valid JWT with ADMIN role.
     */
    private boolean isAdminRequest(HttpServletRequest request) {
        try {
            String header = request.getHeader("Authorization");
            if (!StringUtils.hasText(header) || !header.startsWith("Bearer ")) {
                return false;
            }
            String token = header.substring(7);
            Claims claims = jwtUtils.parseTokenSafe(token);
            return claims != null && "ADMIN".equals(claims.get("role", String.class));
        } catch (Exception e) {
            return false;
        }
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
