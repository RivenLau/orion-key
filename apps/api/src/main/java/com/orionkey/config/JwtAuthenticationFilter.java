package com.orionkey.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.common.ApiResponse;
import com.orionkey.constant.ErrorCode;
import com.orionkey.context.RequestContext;
import com.orionkey.entity.User;
import com.orionkey.repository.UserRepository;
import com.orionkey.utils.JwtUtils;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String token = extractToken(request);
            if (StringUtils.hasText(token)) {
                Claims claims = jwtUtils.parseTokenSafe(token);
                if (claims != null) {
                    UUID userId = UUID.fromString(claims.getSubject());
                    String username = claims.get("username", String.class);
                    String role = claims.get("role", String.class);

                    // 管理员请求：必须校验数据库中用户状态和角色
                    String path = request.getRequestURI();
                    if ("ADMIN".equals(role) && path.startsWith("/api/admin")) {
                        User user = userRepository.findById(userId).orElse(null);
                        if (user == null || user.getIsDeleted() == 1
                                || !user.getRole().name().equals(role)) {
                            log.warn("Admin JWT verification failed: userId={}, dbExists={}, dbDeleted={}, dbRole={}",
                                    userId, user != null, user != null ? user.getIsDeleted() : "N/A",
                                    user != null ? user.getRole() : "N/A");
                            rejectRequest(response, "身份验证失败，请重新登录");
                            return;
                        }
                    }

                    RequestContext.set(new RequestContext.UserInfo(userId, username, role));

                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                    var auth = new UsernamePasswordAuthenticationToken(userId, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
            filterChain.doFilter(request, response);
        } finally {
            RequestContext.clear();
        }
    }

    private void rejectRequest(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(
                ApiResponse.error(ErrorCode.UNAUTHORIZED, message)));
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
