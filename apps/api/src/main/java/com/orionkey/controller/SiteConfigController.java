package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.service.SiteConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class SiteConfigController {

    private final SiteConfigService siteConfigService;

    @GetMapping("/site/config")
    public ApiResponse<?> getPublicConfig() {
        return ApiResponse.success(siteConfigService.getPublicConfig());
    }
}
