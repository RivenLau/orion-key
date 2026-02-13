package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.context.RequestContext;
import com.orionkey.service.CartService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ApiResponse<?> getCart(
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken) {
        return ApiResponse.success(cartService.getCart(RequestContext.getUserId(), sessionToken));
    }

    @PostMapping("/items")
    public ApiResponse<Void> addItem(
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
            @RequestBody Map<String, Object> request,
            HttpServletResponse response) {
        String newSessionToken = cartService.addItem(RequestContext.getUserId(), sessionToken, request);
        if (newSessionToken != null && !newSessionToken.equals(sessionToken)) {
            response.setHeader("X-Session-Token", newSessionToken);
        }
        return ApiResponse.success();
    }

    @PutMapping("/items/{id}")
    public ApiResponse<Void> updateItem(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
            @RequestBody Map<String, Object> request) {
        int quantity = ((Number) request.get("quantity")).intValue();
        cartService.updateItem(RequestContext.getUserId(), sessionToken, id, quantity);
        return ApiResponse.success();
    }

    @DeleteMapping("/items/{id}")
    public ApiResponse<Void> deleteItem(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken) {
        cartService.deleteItem(RequestContext.getUserId(), sessionToken, id);
        return ApiResponse.success();
    }
}
