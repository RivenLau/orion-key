package com.orionkey.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${upload.path:./uploads}")
    private String uploadPath;

    /** CORS 允许的来源列表，逗号分隔。默认允许 localhost 开发环境。 */
    @Value("${cors.allowed-origins:http://localhost:3000,http://localhost:3001}")
    private String corsAllowedOrigins;

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);  // 连接超时 5 秒
        factory.setReadTimeout(15_000);    // 读取超时 15 秒
        return new RestTemplate(factory);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = Arrays.stream(corsAllowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);

        if (origins.length == 0 || (origins.length == 1 && "*".equals(origins[0]))) {
            // 通配符模式：不允许 credentials
            registry.addMapping("/**")
                    .allowedOriginPatterns("*")
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("Content-Type", "Authorization", "X-Session-Token")
                    .exposedHeaders("X-Session-Token")
                    .allowCredentials(false)
                    .maxAge(3600);
        } else {
            registry.addMapping("/**")
                    .allowedOrigins(origins)
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("Content-Type", "Authorization", "X-Session-Token")
                    .exposedHeaders("X-Session-Token")
                    .allowCredentials(true)
                    .maxAge(3600);
        }
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path dir = Paths.get(uploadPath);
        if (!dir.isAbsolute()) {
            dir = Paths.get(System.getProperty("user.dir")).resolve(uploadPath).normalize();
        }
        String location = "file:" + dir.toString().replace('\\', '/') + "/";
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location);
    }
}
