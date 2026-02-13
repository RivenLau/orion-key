package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping("/categories")
    public ApiResponse<?> listCategories() {
        return ApiResponse.success(categoryService.listCategories());
    }
}
