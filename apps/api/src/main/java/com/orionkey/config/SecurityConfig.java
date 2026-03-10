package com.orionkey.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomAuthenticationEntryPoint authenticationEntryPoint;
    private final CustomAccessDeniedHandler accessDeniedHandler;

    @Value("${security.password-plain:false}")
    private boolean passwordPlain;

    @SuppressWarnings("deprecation")
    @Bean
    public PasswordEncoder passwordEncoder() {
        return passwordPlain ? NoOpPasswordEncoder.getInstance() : new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(contentType -> {})  // X-Content-Type-Options: nosniff
                        .httpStrictTransportSecurity(hsts -> hsts
                                .maxAgeInSeconds(31536000)
                                .includeSubDomains(true))
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/auth/captcha", "/auth/register", "/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/products/**", "/categories", "/site/config", "/payment-channels", "/currencies").permitAll()
                        .requestMatchers("/orders/query", "/orders/deliver").permitAll()
                        .requestMatchers(HttpMethod.GET, "/orders/*/status", "/orders/*/export").permitAll()
                        .requestMatchers(HttpMethod.POST, "/orders").permitAll()
                        .requestMatchers(HttpMethod.POST, "/orders/from-cart").permitAll()
                        .requestMatchers(HttpMethod.POST, "/orders/*/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/orders/*/txid-verify").permitAll()
                        .requestMatchers(HttpMethod.POST, "/orders/*/repay").permitAll()
                        .requestMatchers("/payments/webhook/**").permitAll()
                        .requestMatchers("/cart/**").permitAll()
                        .requestMatchers("/uploads/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/visit/track").permitAll()
                        // Authenticated user endpoints
                        .requestMatchers("/auth/logout").authenticated()
                        .requestMatchers("/user/**").authenticated()
                        // Admin endpoints
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .requestMatchers("/upload/**").hasRole("ADMIN")
                        // Default
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
