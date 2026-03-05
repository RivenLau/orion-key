package com.orionkey.service.impl;

import com.orionkey.entity.SiteConfig;
import com.orionkey.repository.SiteConfigRepository;
import com.orionkey.service.SiteConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class SiteConfigServiceImpl implements SiteConfigService {

    private final SiteConfigRepository siteConfigRepository;

    private static final Set<String> NUMERIC_KEYS = Set.of("points_rate");

    private static final List<String> PUBLIC_KEYS = List.of(
            "site_name", "site_slogan", "site_description", "logo_url", "favicon_url",
            "announcement_enabled", "announcement", "popup_enabled", "popup_content",
            "contact_email", "contact_telegram", "contact_telegram_group", "points_enabled", "points_rate",
            "maintenance_enabled", "maintenance_message", "footer_text", "github_url", "custom_css"
    );

    @Override
    public Map<String, Object> getPublicConfig() {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String key : PUBLIC_KEYS) {
            siteConfigRepository.findByConfigKey(key).ifPresent(c -> {
                String val = c.getConfigValue();
                if ("true".equalsIgnoreCase(val) || "false".equalsIgnoreCase(val)) {
                    result.put(key, Boolean.parseBoolean(val));
                } else if (NUMERIC_KEYS.contains(key)) {
                    try {
                        result.put(key, Integer.parseInt(val));
                    } catch (NumberFormatException e) {
                        result.put(key, val);
                    }
                } else {
                    result.put(key, val);
                }
            });
        }
        return result;
    }

    @Override
    public List<?> getAllConfigs() {
        return siteConfigRepository.findAll().stream()
                .map(c -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("config_key", c.getConfigKey());
                    map.put("config_value", c.getConfigValue());
                    map.put("config_group", c.getConfigGroup());
                    return map;
                }).toList();
    }

    @Override
    @Transactional
    public void updateConfigs(List<Map<String, String>> configs) {
        for (Map<String, String> item : configs) {
            String key = item.get("config_key");
            String value = item.get("config_value");
            SiteConfig config = siteConfigRepository.findByConfigKey(key)
                    .orElseGet(() -> {
                        SiteConfig c = new SiteConfig();
                        c.setConfigKey(key);
                        return c;
                    });
            config.setConfigValue(value);
            siteConfigRepository.save(config);
        }
    }

    @Override
    @Transactional
    public void toggleMaintenance(boolean enabled) {
        SiteConfig config = siteConfigRepository.findByConfigKey("maintenance_enabled")
                .orElseGet(() -> {
                    SiteConfig c = new SiteConfig();
                    c.setConfigKey("maintenance_enabled");
                    c.setConfigGroup("site");
                    return c;
                });
        config.setConfigValue(String.valueOf(enabled));
        siteConfigRepository.save(config);
    }
}
