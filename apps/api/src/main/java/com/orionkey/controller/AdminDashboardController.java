package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public ApiResponse<?> getStats() {
        return ApiResponse.success(dashboardService.getStats());
    }

    @GetMapping("/sales-trend")
    public ApiResponse<?> getSalesTrend(
            @RequestParam String period,
            @RequestParam(value = "start_date", required = false) String startDate,
            @RequestParam(value = "end_date", required = false) String endDate) {
        return ApiResponse.success(dashboardService.getSalesTrend(period, startDate, endDate));
    }
}
