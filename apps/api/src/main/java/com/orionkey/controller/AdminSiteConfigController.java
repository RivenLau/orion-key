package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.service.SiteConfigService;
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

    @SuppressWarnings("unchecked")
    @PutMapping
    public ApiResponse<Void> updateConfigs(@RequestBody Map<String, Object> request) {
        List<Map<String, String>> configs = (List<Map<String, String>>) request.get("configs");
        siteConfigService.updateConfigs(configs);
        return ApiResponse.success();
    }

    @PostMapping("/maintenance")
    public ApiResponse<Void> toggleMaintenance(@RequestBody Map<String, Object> request) {
        boolean enabled = (boolean) request.get("enabled");
        siteConfigService.toggleMaintenance(enabled);
        return ApiResponse.success();
    }
}
