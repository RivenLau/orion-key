package com.orionkey.controller;

import com.orionkey.annotation.LogOperation;
import com.orionkey.common.ApiResponse;
import com.orionkey.constant.DemoProtectedIds;
import com.orionkey.service.AdminPaymentChannelService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/payment-channels")
@RequiredArgsConstructor
public class AdminPaymentChannelController {

    private final AdminPaymentChannelService adminPaymentChannelService;

    @GetMapping
    public ApiResponse<?> listChannels() {
        return ApiResponse.success(adminPaymentChannelService.listChannels());
    }

    @LogOperation(action = "payment.create", targetType = "PAYMENT_CHANNEL", detail = "'创建支付渠道'")
    @PostMapping
    public ApiResponse<Void> createChannel(@RequestBody Map<String, Object> request) {
        adminPaymentChannelService.createChannel(request);
        return ApiResponse.success();
    }

    @LogOperation(action = "payment.update", targetType = "PAYMENT_CHANNEL", targetId = "#id", detail = "'修改支付渠道'")
    @PutMapping("/{id}")
    public ApiResponse<Void> updateChannel(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        DemoProtectedIds.denyIfProtectedPaymentChannel(id);
        adminPaymentChannelService.updateChannel(id, request);
        return ApiResponse.success();
    }

    @LogOperation(action = "payment.delete", targetType = "PAYMENT_CHANNEL", targetId = "#id", detail = "'删除支付渠道'")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteChannel(@PathVariable UUID id) {
        DemoProtectedIds.denyIfProtectedPaymentChannel(id);
        adminPaymentChannelService.deleteChannel(id);
        return ApiResponse.success();
    }
}
