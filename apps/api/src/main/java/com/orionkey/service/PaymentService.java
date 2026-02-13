package com.orionkey.service;

import java.util.Map;
import java.util.UUID;

public interface PaymentService {

    /**
     * Create payment for an order (stub implementation).
     * Returns payment info: {order_id, payment_url, expires_at}
     */
    Map<String, Object> createPayment(UUID orderId, String paymentMethod, java.math.BigDecimal amount);
}
