package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/categories")
@RequiredArgsConstructor
public class AdminCategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ApiResponse<?> listCategories() {
        return ApiResponse.success(categoryService.listCategories());
    }

    @PostMapping
    public ApiResponse<Void> createCategory(@RequestBody Map<String, Object> request) {
        categoryService.createCategory(request);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> updateCategory(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        categoryService.updateCategory(id, request);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteCategory(@PathVariable UUID id) {
        categoryService.deleteCategory(id);
        return ApiResponse.success();
    }
}
