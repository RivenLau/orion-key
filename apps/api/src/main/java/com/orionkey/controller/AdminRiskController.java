package com.orionkey.controller;

import com.orionkey.annotation.LogOperation;
import com.orionkey.common.ApiResponse;
import com.orionkey.service.RiskConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminRiskController {

    private final RiskConfigService riskConfigService;

    @GetMapping("/risk-config")
    public ApiResponse<?> getRiskConfig() {
        return ApiResponse.success(riskConfigService.getRiskConfig());
    }

    @LogOperation(action = "config.update", targetType = "RISK_CONFIG", detail = "'更新风控配置'")
    @PutMapping("/risk-config")
    public ApiResponse<Void> updateRiskConfig(@RequestBody Map<String, Object> request) {
        riskConfigService.updateRiskConfig(request);
        return ApiResponse.success();
    }

    @GetMapping("/risk/flagged-orders")
    public ApiResponse<?> getFlaggedOrders(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(riskConfigService.getFlaggedOrders(page, pageSize));
    }
}
