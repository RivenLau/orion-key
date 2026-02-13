package com.orionkey.controller;

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

    @GetMapping("/stock")
    public ApiResponse<?> getStockSummary(
            @RequestParam(value = "product_id", required = false) UUID productId,
            @RequestParam(value = "spec_id", required = false) UUID specId) {
        return ApiResponse.success(adminCardKeyService.getStockSummary(productId, specId));
    }

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

    @PostMapping("/{id}/invalidate")
    public ApiResponse<Void> invalidateCardKey(@PathVariable UUID id) {
        adminCardKeyService.invalidateCardKey(id);
        return ApiResponse.success();
    }

    @GetMapping("/by-order/{orderId}")
    public ApiResponse<?> getCardKeysByOrder(@PathVariable UUID orderId) {
        return ApiResponse.success(adminCardKeyService.getCardKeysByOrder(orderId));
    }
}
