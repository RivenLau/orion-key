package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.context.RequestContext;
import com.orionkey.service.DeliverService;
import com.orionkey.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final DeliverService deliverService;

    @PostMapping
    public ApiResponse<?> createOrder(@RequestBody Map<String, Object> request,
                                      @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                      HttpServletRequest httpRequest) {
        return ApiResponse.success(orderService.createDirectOrder(
                request, RequestContext.getUserId(), httpRequest.getRemoteAddr(), sessionToken));
    }

    @PostMapping("/from-cart")
    public ApiResponse<?> createCartOrder(@RequestBody Map<String, Object> request,
                                          @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                          HttpServletRequest httpRequest) {
        return ApiResponse.success(orderService.createCartOrder(
                request, RequestContext.getUserId(), httpRequest.getRemoteAddr(), sessionToken));
    }

    @GetMapping("/{id}/status")
    public ApiResponse<?> getOrderStatus(@PathVariable UUID id) {
        return ApiResponse.success(orderService.getOrderStatus(id));
    }

    @PostMapping("/{id}/refresh")
    public ApiResponse<?> refreshOrderStatus(@PathVariable UUID id) {
        return ApiResponse.success(orderService.refreshOrderStatus(id));
    }

    @PostMapping("/query")
    public ApiResponse<?> queryOrders(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(deliverService.queryOrders(request));
    }

    @PostMapping("/deliver")
    public ApiResponse<?> deliverOrders(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(deliverService.deliverOrders(request));
    }

    @GetMapping("/{id}/export")
    public void exportCardKeys(@PathVariable UUID id, HttpServletResponse response) throws Exception {
        String content = deliverService.exportCardKeys(id);
        response.setContentType("text/plain; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=card-keys-" + id + ".txt");
        response.getWriter().write(content);
    }
}
