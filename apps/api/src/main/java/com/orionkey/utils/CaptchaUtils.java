package com.orionkey.utils;

import cn.hutool.captcha.CaptchaUtil;
import cn.hutool.captcha.LineCaptcha;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class CaptchaUtils {

    private final Map<String, CaptchaEntry> store = new ConcurrentHashMap<>();
    private static final long EXPIRE_MS = 5 * 60 * 1000; // 5 minutes

    public record CaptchaResult(String captchaId, String imageBase64) {}

    private record CaptchaEntry(String code, long createdAt) {}

    public CaptchaResult generate() {
        LineCaptcha captcha = CaptchaUtil.createLineCaptcha(150, 40, 4, 80);
        String captchaId = UUID.randomUUID().toString();
        store.put(captchaId, new CaptchaEntry(captcha.getCode().toLowerCase(), System.currentTimeMillis()));
        cleanup();
        return new CaptchaResult(captchaId, captcha.getImageBase64());
    }

    public boolean verify(String captchaId, String code) {
        if (captchaId == null || code == null) return false;
        CaptchaEntry entry = store.remove(captchaId);
        if (entry == null) return false;
        if (System.currentTimeMillis() - entry.createdAt() > EXPIRE_MS) return false;
        return entry.code().equalsIgnoreCase(code);
    }

    private void cleanup() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(e -> now - e.getValue().createdAt() > EXPIRE_MS);
    }
}
