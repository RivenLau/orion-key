package com.orionkey.service;

import java.util.Map;
import java.util.UUID;

public interface PaymentService {

    /**
     * Create payment for an order.
     * Returns payment info: {order_id, payment_url, expires_at}
     */
    Map<String, Object> createPayment(UUID orderId, String paymentMethod, java.math.BigDecimal amount);

    /**
     * Create payment with device hint (pc/mobile/wechat/alipay).
     */
    Map<String, Object> createPayment(UUID orderId, String paymentMethod, java.math.BigDecimal amount, String device);

    /**
     * Re-initiate payment for a PENDING order (clears cached URLs, requests new payment link).
     * @param requestUserId 当前请求用户的 ID（可为 null，表示未登录/游客）
     */
    Map<String, Object> repay(UUID orderId, String device, UUID requestUserId);
}
