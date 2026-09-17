package com.orionkey.controller;

import com.orionkey.annotation.LogOperation;
import com.orionkey.common.ApiResponse;
import com.orionkey.service.SiteConfigService;
import com.orionkey.constant.ErrorCode;
import com.orionkey.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/site-config")
@RequiredArgsConstructor
public class AdminSiteConfigController {

    private final SiteConfigService siteConfigService;

    @GetMapping
    public ApiResponse<?> getAllConfigs() {
        return ApiResponse.success(siteConfigService.getAllConfigs());
    }

    @LogOperation(action = "config.update", targetType = "SITE_CONFIG", detail = "'更新配置'")
    @SuppressWarnings("unchecked")
    @PutMapping
    public ApiResponse<Void> updateConfigs(@RequestBody Map<String, Object> request) {
        if (!(request.get("configs") instanceof List<?> entries) || entries.size() > 100) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Invalid settings payload");
        }
        for (Object entry : entries) {
            if (!(entry instanceof Map<?, ?> item) || !(item.get("config_key") instanceof String)
                    || !(item.get("config_value") instanceof String)
                    || (item.containsKey("expected_value") && !(item.get("expected_value") instanceof String))) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "Invalid settings entry");
            }
        }
        List<Map<String, String>> configs = (List<Map<String, String>>) request.get("configs");
        siteConfigService.updateConfigs(configs);
        return ApiResponse.success();
    }

    @LogOperation(action = "config.update", targetType = "SITE_CONFIG", detail = "'切换维护模式'")
    @PostMapping("/maintenance")
    public ApiResponse<Void> toggleMaintenance(@RequestBody Map<String, Object> request) {
        boolean enabled = (boolean) request.get("enabled");
        siteConfigService.toggleMaintenance(enabled);
        return ApiResponse.success();
    }
}
