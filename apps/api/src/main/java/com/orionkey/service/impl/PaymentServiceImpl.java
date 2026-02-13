package com.orionkey.service.impl;

import com.orionkey.constant.ErrorCode;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.PaymentChannelRepository;
import com.orionkey.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final PaymentChannelRepository paymentChannelRepository;

    @Override
    public Map<String, Object> createPayment(UUID orderId, String paymentMethod, BigDecimal amount) {
        // Verify channel exists and is enabled
        paymentChannelRepository.findByChannelCodeAndIsDeleted(paymentMethod, 0)
                .filter(ch -> ch.isEnabled())
                .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "支付渠道不可用"));

        log.info("Creating payment stub: orderId={}, method={}, amount={}", orderId, paymentMethod, amount);

        // Stub: return mock payment URL
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("order_id", orderId);
        result.put("payment_url", "https://pay.stub.local/pay?order=" + orderId);
        result.put("expires_at", LocalDateTime.now().plusMinutes(15));
        return result;
    }
}
