package com.orionkey.controller;

import com.orionkey.annotation.LogOperation;
import com.orionkey.common.ApiResponse;
import com.orionkey.context.RequestContext;
import com.orionkey.service.AdminCardKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/card-keys")
@RequiredArgsConstructor
public class AdminCardKeyController {

    private final AdminCardKeyService adminCardKeyService;

    @GetMapping("/list")
    public ApiResponse<?> listCardKeys(
            @RequestParam("product_id") UUID productId,
            @RequestParam(value = "spec_id", required = false) UUID specId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(value = "page_size", defaultValue = "20") int pageSize) {
        return ApiResponse.success(adminCardKeyService.listCardKeys(productId, specId, page, pageSize));
    }

    @GetMapping("/stock")
    public ApiResponse<?> getStockSummary(
            @RequestParam(value = "product_id", required = false) UUID productId,
            @RequestParam(value = "spec_id", required = false) UUID specId) {
        return ApiResponse.success(adminCardKeyService.getStockSummary(productId, specId));
    }

    @LogOperation(action = "cardkey.import", targetType = "CARD_KEY", detail = "'导入卡密'")
    @PostMapping("/import")
    public ApiResponse<?> importCardKeys(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(adminCardKeyService.importCardKeys(request, RequestContext.getUserId()));
    }

    @GetMapping("/import-batches")
    public ApiResponse<?> getImportBatches(
            @RequestParam(value = "product_id", required = false) UUID productId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(value = "page_size", defaultValue = "20") int pageSize) {
        return ApiResponse.success(adminCardKeyService.getImportBatches(productId, page, pageSize));
    }

    @LogOperation(action = "cardkey.invalidate", targetType = "CARD_KEY", targetId = "#id", detail = "'作废卡密'")
    @PostMapping("/{id}/invalidate")
    public ApiResponse<Void> invalidateCardKey(@PathVariable UUID id) {
        adminCardKeyService.invalidateCardKey(id);
        return ApiResponse.success();
    }

    @LogOperation(action = "cardkey.invalidate", targetType = "CARD_KEY", detail = "'批量作废'")
    @PostMapping("/batch-invalidate")
    public ApiResponse<?> batchInvalidateCardKeys(
            @RequestParam("product_id") UUID productId,
            @RequestParam(value = "spec_id", required = false) UUID specId) {
        int count = adminCardKeyService.batchInvalidateCardKeys(productId, specId);
        return ApiResponse.success(Map.of("invalidated_count", count));
    }

    @GetMapping("/by-order/{orderId}")
    public ApiResponse<?> getCardKeysByOrder(@PathVariable UUID orderId) {
        return ApiResponse.success(adminCardKeyService.getCardKeysByOrder(orderId));
    }
}
