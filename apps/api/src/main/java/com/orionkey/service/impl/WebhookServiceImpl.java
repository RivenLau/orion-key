package com.orionkey.service.impl;

import com.orionkey.constant.OrderStatus;
import com.orionkey.entity.Order;
import com.orionkey.entity.WebhookEvent;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.WebhookEventRepository;
import com.orionkey.service.WebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookServiceImpl implements WebhookService {

    private final WebhookEventRepository webhookEventRepository;
    private final OrderRepository orderRepository;

    @Override
    @Transactional
    public String processWebhook(String channelCode, Map<String, Object> payload) {
        // Step 1: Verify signature (stub - always pass)
        log.info("Webhook received: channel={}, payload={}", channelCode, payload);

        String eventId = (String) payload.getOrDefault("event_id", UUID.randomUUID().toString());
        String orderIdStr = (String) payload.get("order_id");

        // Check idempotency
        Optional<WebhookEvent> existingEvent = webhookEventRepository.findByEventId(eventId);
        if (existingEvent.isPresent()) {
            log.info("Webhook event already processed: {}", eventId);
            return "OK";
        }

        // Save webhook event
        WebhookEvent event = new WebhookEvent();
        event.setEventId(eventId);
        event.setChannelCode(channelCode);
        event.setOrderId(orderIdStr != null ? UUID.fromString(orderIdStr) : null);
        event.setPayload(payload.toString());
        event.setProcessResult("PROCESSING");

        // Step 2: Update order to PAID
        if (orderIdStr != null) {
            UUID orderId = UUID.fromString(orderIdStr);
            event.setOrderId(orderId);

            Order order = orderRepository.findById(orderId).orElse(null);
            if (order != null) {
                if (order.getStatus() == OrderStatus.PENDING) {
                    order.setStatus(OrderStatus.PAID);
                    order.setPaidAt(LocalDateTime.now());
                    orderRepository.save(order);
                    event.setProcessResult("SUCCESS");
                    log.info("Order marked as PAID: {}", orderId);
                } else {
                    event.setProcessResult("SKIPPED_" + order.getStatus().name());
                    log.info("Order already {}: {}", order.getStatus(), orderId);
                }
            } else {
                event.setProcessResult("ORDER_NOT_FOUND");
                log.warn("Webhook order not found: {}", orderId);
            }
        }

        webhookEventRepository.save(event);

        // Step 3: Return ACK
        return "OK";
    }
}
