package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/products")
@RequiredArgsConstructor
public class AdminProductController {

    private final ProductService productService;

    @GetMapping
    public ApiResponse<?> listProducts(
            @RequestParam(value = "category_id", required = false) UUID categoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(value = "is_enabled", required = false) Boolean isEnabled,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(value = "page_size", defaultValue = "20") int pageSize) {
        return ApiResponse.success(productService.listAdminProducts(categoryId, keyword, isEnabled, page, pageSize));
    }

    @PostMapping
    public ApiResponse<?> createProduct(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(productService.createProduct(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<?> getProduct(@PathVariable UUID id) {
        return ApiResponse.success(productService.getAdminProductDetail(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> updateProduct(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        productService.updateProduct(id, request);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteProduct(@PathVariable UUID id) {
        productService.deleteProduct(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/specs")
    public ApiResponse<?> listSpecs(@PathVariable UUID id) {
        return ApiResponse.success(productService.listSpecs(id));
    }

    @PostMapping("/{id}/specs")
    public ApiResponse<Void> createSpec(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        productService.createSpec(id, request);
        return ApiResponse.success();
    }

    @PutMapping("/{productId}/specs/{specId}")
    public ApiResponse<Void> updateSpec(@PathVariable UUID productId, @PathVariable UUID specId,
                                        @RequestBody Map<String, Object> request) {
        productService.updateSpec(productId, specId, request);
        return ApiResponse.success();
    }

    @DeleteMapping("/{productId}/specs/{specId}")
    public ApiResponse<Void> deleteSpec(@PathVariable UUID productId, @PathVariable UUID specId) {
        productService.deleteSpec(productId, specId);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/wholesale-rules")
    public ApiResponse<?> listWholesaleRules(@PathVariable UUID id) {
        return ApiResponse.success(productService.listWholesaleRules(id));
    }

    @PostMapping("/{id}/wholesale-rules")
    public ApiResponse<Void> setWholesaleRules(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        productService.setWholesaleRules(id, request);
        return ApiResponse.success();
    }
}
