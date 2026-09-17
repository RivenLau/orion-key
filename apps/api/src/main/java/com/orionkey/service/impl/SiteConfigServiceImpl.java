package com.orionkey.service.impl;

import com.orionkey.entity.SiteConfig;
import com.orionkey.repository.SiteConfigRepository;
import com.orionkey.service.SiteConfigService;
import com.orionkey.constant.ErrorCode;
import com.orionkey.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Pattern;
import java.net.URI;

@Slf4j
@Service
@RequiredArgsConstructor
public class SiteConfigServiceImpl implements SiteConfigService {

    private final SiteConfigRepository siteConfigRepository;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Value("${turnstile.site-key:}")
    private String turnstileSiteKey;

    private static final Set<String> NUMERIC_KEYS = Set.of("points_rate");

    private static final List<String> PUBLIC_KEYS = List.of(
            "site_name", "site_slogan", "site_description", "logo_url", "favicon_url",
            "announcement_enabled", "announcement", "popup_enabled", "popup_content",
            "contact_email", "contact_telegram", "contact_telegram_group", "points_enabled", "points_rate",
            "maintenance_enabled", "maintenance_message", "footer_text", "github_url", "custom_css", "homepage_ads"
    );

    /** F16: 管理员允许编辑的配置键白名单 — 防止写入系统内部键或注入任意配置 */
    private static final Set<String> EDITABLE_KEYS = Set.of(
            // 站点基础
            "site_name", "site_slogan", "site_description", "logo_url", "favicon_url",
            // 公告 / 弹窗
            "announcement_enabled", "announcement", "popup_enabled", "popup_content",
            "homepage_ads",
            // 联系方式
            "contact_email", "contact_telegram", "contact_telegram_group",
            // 积分
            "points_enabled", "points_rate",
            // 维护模式
            "maintenance_enabled", "maintenance_message",
            // 页脚 / 外链
            "footer_text", "github_url",
            // 自定义样式
            "custom_css",
            // 系统参数
            "order_expire_minutes", "max_pending_orders_per_user", "max_pending_orders_per_ip",
            "rate_limit_per_second"
    );

    /** F15: CSS 危险模式 — 用于过滤 custom_css 中的 XSS 向量 */
    private static final Pattern CSS_DANGEROUS_PATTERNS = Pattern.compile(
            "(?i)(expression\\s*\\(|javascript\\s*:|@import\\s|\\\\00|behavior\\s*:|" +
            "-moz-binding\\s*:|url\\s*\\(\\s*[\"']?\\s*javascript)",
            Pattern.CASE_INSENSITIVE
    );

    @Override
    public Map<String, Object> getPublicConfig() {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String key : PUBLIC_KEYS) {
            siteConfigRepository.findByConfigKey(key).ifPresent(c -> {
                String val = c.getConfigValue();
                if ("homepage_ads".equals(key)) {
                    try {
                        result.put(key, validateHomeAds(val));
                    } catch (BusinessException e) {
                        log.warn("Invalid homepage advertising configuration; hiding advertisements");
                        result.put(key, Map.of("enabled", false, "intervalSeconds", 6, "items", List.of()));
                    }
                } else if ("true".equalsIgnoreCase(val) || "false".equalsIgnoreCase(val)) {
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
        // F15: 对 custom_css 进行安全过滤，防止存储型 XSS
        if (result.containsKey("custom_css") && result.get("custom_css") instanceof String css) {
            result.put("custom_css", sanitizeCss(css));
        }
        // Turnstile Site Key：仅在后台开关启用时才返回给前端，确保前后端状态一致
        boolean turnstileEnabled = siteConfigRepository.findByConfigKey("turnstile_enabled")
                .map(c -> "true".equalsIgnoreCase(c.getConfigValue()))
                .orElse(false);
        if (turnstileEnabled && turnstileSiteKey != null && !turnstileSiteKey.isBlank()) {
            result.put("turnstile_site_key", turnstileSiteKey);
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
            // F16: 只允许白名单内的 key 被修改，防止注入系统内部配置
            if (key == null || !EDITABLE_KEYS.contains(key)) {
                log.warn("Rejected config update for non-editable key: {}", key);
                continue;
            }
            if ("homepage_ads".equals(key)) {
                value = validateHomeAds(value).toString();
                String expected = item.get("expected_value");
                requireAd(expected != null && expected.length() <= 250_000, "Missing advertisement update precondition");
                if (siteConfigRepository.updateHomeAdsIfUnchanged(expected, value) == 0) {
                    if (!expected.isEmpty() || siteConfigRepository.findByConfigKey(key).isPresent()) {
                        throw new BusinessException(ErrorCode.CONFIG_CONFLICT, "Advertisement settings changed; reload before saving");
                    }
                    try {
                        siteConfigRepository.saveAndFlush(new SiteConfig(key, value, "site"));
                    } catch (org.springframework.dao.DataIntegrityViolationException e) {
                        throw new BusinessException(ErrorCode.CONFIG_CONFLICT, "Advertisement settings changed; reload before saving");
                    }
                }
                continue;
            }
            // F15: Apply CSS safety filtering before storage as well.
            if ("custom_css".equals(key) && value != null) {
                value = sanitizeCss(value);
            }
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

    private JsonNode validateHomeAds(String value) {
        try {
            requireAd(value != null && value.length() <= 250_000, "广告配置过大或为空");
            JsonNode root = objectMapper.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS,
                    DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY).readTree(value);
            requireAd(root != null && root.isObject(), "广告配置必须为对象");
            checkAdFields(root, Set.of("enabled", "intervalSeconds", "items", "startFromFirst"));
            requireAd(!root.has("startFromFirst") || root.path("startFromFirst").isBoolean(), "Invalid start mode");
            requireAd(root.path("enabled").isBoolean(), "广告总开关必须为布尔值");
            JsonNode interval = root.path("intervalSeconds");
            requireAd(interval.isIntegralNumber() && interval.canConvertToInt()
                    && interval.intValue() >= 3 && interval.intValue() <= 60, "轮播间隔须为 3 至 60 秒的整数");
            JsonNode items = root.path("items");
            requireAd(items.isArray() && items.size() <= 20, "最多配置 20 条广告");
            Set<String> ids = new HashSet<>();
            for (JsonNode item : items) {
                requireAd(item.isObject(), "广告条目必须为对象");
                checkAdFields(item, Set.of("id", "name", "image", "darkImage", "mobileImage", "darkMobileImage", "href", "alt", "enabled", "sort_order"));
                JsonNode order = item.get("sort_order");
                requireAd(order == null || (order.isIntegralNumber() && order.canConvertToInt()
                        && order.intValue() >= 0 && order.intValue() <= 999999), "Invalid advertisement sort order");
                String id = adText(item, "id", 64);
                requireAd(id.matches("[A-Za-z0-9_-]{1,64}") && ids.add(id), "广告 ID 无效或重复");
                if (item.has("name")) adText(item, "name", 80);
                requireAd(item.path("enabled").isBoolean(), "广告启停必须为布尔值");
                requireAd(validAdUrl(adText(item, "href", 2048), false), "请输入以 http:// 或 https:// 开头的完整链接");
                requireAd(validAdUrl(adText(item, "image", 2048), true), "海报须使用本站素材或上传图片路径");
                for (String field : List.of("darkImage", "mobileImage", "darkMobileImage")) {
                    if (!item.has(field)) continue;
                    JsonNode image = item.get(field);
                    requireAd(image.isTextual() && image.textValue().length() <= 2048
                            && (image.textValue().isEmpty() || validAdUrl(image.textValue(), true)), "可选海报地址无效");
                }
                // Keep existing configurations readable without requiring legacy descriptions.
                if (item.has("alt")) {
                    JsonNode alt = item.path("alt");
                    requireAd(alt.isObject(), "Invalid legacy advertisement description");
                    checkAdFields(alt, Set.of("zh", "en"));
                    adText(alt, "zh", 300);
                    adText(alt, "en", 300);
                }
            }
            return root;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "广告配置 JSON 格式无效");
        }
    }

    private static String adText(JsonNode node, String key, int maxLength) {
        JsonNode value = node.path(key);
        requireAd(value.isTextual() && !value.textValue().isBlank()
                && value.textValue().length() <= maxLength, "广告字段无效: " + key);
        return value.textValue();
    }

    private static void checkAdFields(JsonNode node, Set<String> allowed) {
        node.fieldNames().forEachRemaining(key -> requireAd(allowed.contains(key), "未知广告字段: " + key));
    }

    private static boolean validAdUrl(String value, boolean allowLocal) {
        if (value.indexOf('\\') >= 0 || value.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c))) return false;
        if (allowLocal) return value.matches("/(?:ads|(?:api/)?uploads)/[A-Za-z0-9_-]+\\.(?:jpe?g|png|webp|gif)");
        try {
            URI uri = URI.create(value);
            if (!"http".equalsIgnoreCase(uri.getScheme())
                    && !"https".equalsIgnoreCase(uri.getScheme())) return false;
            String authority = uri.getRawAuthority();
            if (authority == null || authority.contains("@")) return false;
            // Validate internationalized hostnames without changing the stored destination.
            if (uri.getHost() == null && !authority.startsWith("[")) {
                int colon = authority.lastIndexOf(':');
                String host = colon < 0 ? authority : authority.substring(0, colon);
                String port = colon < 0 ? "" : authority.substring(colon);
                uri = URI.create("//" + java.net.IDN.toASCII(host, java.net.IDN.USE_STD3_ASCII_RULES) + port);
            }
            return uri.getHost() != null && uri.getRawUserInfo() == null
                    && uri.getPort() >= -1 && uri.getPort() <= 65535;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static void requireAd(boolean valid, String message) {
        if (!valid) throw new BusinessException(ErrorCode.BAD_REQUEST, message);
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

    /**
     * 过滤 CSS 中的危险内容，防止存储型 XSS。
     * 移除 HTML 标签和已知 CSS XSS 向量（expression/javascript:/behavior 等）。
     */
    private String sanitizeCss(String css) {
        if (css == null) return null;
        // 移除所有 HTML 标签（防止 </style><script>... 注入）
        css = css.replaceAll("<[^>]*>", "");
        // 移除危险 CSS 模式
        css = CSS_DANGEROUS_PATTERNS.matcher(css).replaceAll("/* blocked */");
        return css;
    }
}
