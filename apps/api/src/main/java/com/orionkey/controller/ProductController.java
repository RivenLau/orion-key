package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping("/products")
    public ApiResponse<?> listProducts(
            @RequestParam(value = "category_id", required = false) UUID categoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(value = "page_size", defaultValue = "20") int pageSize) {
        return ApiResponse.success(productService.listPublicProducts(categoryId, keyword, page, pageSize));
    }

    @GetMapping("/products/{id}")
    public ApiResponse<?> getProduct(@PathVariable UUID id) {
        return ApiResponse.success(productService.getProductDetail(id));
    }
}
