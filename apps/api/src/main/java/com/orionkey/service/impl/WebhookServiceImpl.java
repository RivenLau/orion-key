package com.orionkey.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.constant.ErrorCode;
import com.orionkey.constant.OrderStatus;
import com.orionkey.exception.BusinessException;
import com.orionkey.entity.Order;
import com.orionkey.entity.PaymentChannel;
import com.orionkey.entity.WebhookEvent;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.PaymentChannelRepository;
import com.orionkey.repository.WebhookEventRepository;
import com.orionkey.service.BepusdtService;
import com.orionkey.service.EpayService;
import com.orionkey.service.WebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookServiceImpl implements WebhookService {

    private final WebhookEventRepository webhookEventRepository;
    private final OrderRepository orderRepository;
    private final PaymentChannelRepository paymentChannelRepository;
    private final EpayService epayService;
    private final BepusdtService bepusdtService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public String processWebhook(String channelCode, Map<String, Object> payload) {
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
        return "OK";
    }

    @Override
    @Transactional
    public String processEpayCallback(Map<String, String> params) {
        String tradeNo = params.get("trade_no");
        String outTradeNo = params.get("out_trade_no");
        String tradeStatus = params.get("trade_status");
        String money = params.get("money");
        String sign = params.get("sign");

        log.info("Epay callback: out_trade_no={}, trade_status={}, money={}", outTradeNo, tradeStatus, money);

        // Use trade_no as event ID for idempotency
        String eventId = "epay_" + (tradeNo != null ? tradeNo : UUID.randomUUID().toString());
        Optional<WebhookEvent> existingEvent = webhookEventRepository.findByEventId(eventId);
        if (existingEvent.isPresent()) {
            log.info("Epay callback already processed: {}", eventId);
            return "SUCCESS";
        }

        // Step 1: Parse order ID
        UUID orderId;
        try {
            orderId = UUID.fromString(outTradeNo);
        } catch (IllegalArgumentException e) {
            log.error("Epay callback invalid out_trade_no: {}", outTradeNo);
            return "FAIL";
        }

        // Step 2: Resolve merchant key from order's channel config
        String merchantKey = resolveMerchantKey(orderId);

        // Step 3: Verify signature
        if (!epayService.verifySign(merchantKey, params, sign)) {
            log.error("Epay callback signature verification failed: out_trade_no={}", outTradeNo);
            WebhookEvent event = new WebhookEvent();
            event.setEventId(eventId);
            event.setChannelCode("epay");
            event.setPayload(params.toString());
            event.setProcessResult("SIGN_VERIFY_FAIL");
            webhookEventRepository.save(event);
            return "FAIL";
        }

        // Step 4: Check trade status
        if (!"TRADE_SUCCESS".equals(tradeStatus)) {
            log.info("Epay callback non-success status: {}", tradeStatus);
            WebhookEvent event = new WebhookEvent();
            event.setEventId(eventId);
            event.setChannelCode("epay");
            event.setPayload(params.toString());
            event.setProcessResult("SKIPPED_" + tradeStatus);
            webhookEventRepository.save(event);
            return "SUCCESS";
        }

        // Step 5: Process payment
        WebhookEvent event = new WebhookEvent();
        event.setEventId(eventId);
        event.setChannelCode("epay");
        event.setOrderId(orderId);
        event.setPayload(params.toString());

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            event.setProcessResult("ORDER_NOT_FOUND");
            log.warn("Epay callback order not found: {}", orderId);
            webhookEventRepository.save(event);
            return "SUCCESS";
        }

        // Step 6: Verify amount matches
        if (money != null) {
            BigDecimal callbackAmount = new BigDecimal(money);
            if (order.getActualAmount().compareTo(callbackAmount) != 0) {
                log.error("Epay callback amount mismatch: order={}, callback={}", order.getActualAmount(), callbackAmount);
                event.setProcessResult("AMOUNT_MISMATCH");
                webhookEventRepository.save(event);
                return "SUCCESS";
            }
        }

        // Step 7: Idempotent update order status
        if (order.getStatus() == OrderStatus.PENDING) {
            order.setStatus(OrderStatus.PAID);
            order.setPaidAt(LocalDateTime.now());
            orderRepository.save(order);
            event.setProcessResult("SUCCESS");
            log.info("Epay callback: order {} marked as PAID", orderId);
        } else {
            event.setProcessResult("SKIPPED_" + order.getStatus().name());
            log.info("Epay callback: order {} already {}", orderId, order.getStatus());
        }

        webhookEventRepository.save(event);
        return "SUCCESS";
    }

    @Override
    @Transactional
    public String processBepusdtCallback(Map<String, Object> params) {
        // BEpusdt 回调 JSON 含非 String 类型（amount: float64, status: int），
        // 转为 Map<String, String> 用于签名验证（Object.toString() 与 Go 的 fmt.Sprintf("%v", v) 输出一致）
        Map<String, String> signParams = new LinkedHashMap<>();
        for (var entry : params.entrySet()) {
            if (entry.getValue() != null) {
                signParams.put(entry.getKey(), entry.getValue().toString());
            }
        }

        String tradeId = signParams.get("trade_id");
        String orderId = signParams.get("order_id");
        String status = signParams.get("status");
        String blockTxId = signParams.get("block_transaction_id");
        String signature = signParams.get("signature");

        log.info("BEpusdt callback: trade_id={}, order_id={}, status={}, block_tx_id={}",
                tradeId, orderId, status, blockTxId);

        // 1. 幂等检查
        String eventId = "bepusdt_" + tradeId;
        if (webhookEventRepository.findByEventId(eventId).isPresent()) {
            log.info("BEpusdt callback already processed: {}", eventId);
            return "ok";
        }

        // 2. 解析订单
        UUID orderUuid;
        try {
            orderUuid = UUID.fromString(orderId);
        } catch (IllegalArgumentException e) {
            log.error("BEpusdt callback invalid order_id: {}", orderId);
            return "ok";
        }

        Order order = orderRepository.findById(orderUuid).orElse(null);
        if (order == null) {
            saveWebhookEvent(eventId, "usdt", null, signParams.toString(), "ORDER_NOT_FOUND");
            log.warn("BEpusdt callback order not found: {}", orderId);
            return "ok";
        }

        // 3. 验签（apiToken 为空则拒绝，防止跳过签名验证）
        String apiToken = resolveBepusdtApiToken(order);
        if (apiToken == null) {
            log.error("BEpusdt callback rejected: api_token not configured for channel {}", order.getPaymentMethod());
            saveWebhookEvent(eventId, "usdt", order.getId(), signParams.toString(), "NO_API_TOKEN");
            return "fail";
        }
        if (!bepusdtService.verifySign(apiToken, signParams, signature)) {
            log.error("BEpusdt callback signature verification failed: trade_id={}", tradeId);
            saveWebhookEvent(eventId, "usdt", order.getId(), signParams.toString(), "SIGN_VERIFY_FAIL");
            return "fail";
        }

        // 4. 状态检查（只处理 status=2 即支付成功）
        if (!"2".equals(status)) {
            log.info("BEpusdt callback non-success status: {}", status);
            saveWebhookEvent(eventId, "usdt", order.getId(), signParams.toString(), "STATUS_" + status);
            return "ok";
        }

        // 5. 金额校验（actual_amount 为 USDT 链上金额）
        String actualAmount = signParams.get("actual_amount");
        if (actualAmount != null && order.getUsdtCryptoAmount() != null) {
            BigDecimal callbackAmount = new BigDecimal(actualAmount);
            BigDecimal orderAmount = new BigDecimal(order.getUsdtCryptoAmount());
            if (callbackAmount.compareTo(orderAmount) != 0) {
                log.error("BEpusdt callback amount mismatch: expected={}, actual={}, order={}",
                        orderAmount, callbackAmount, orderId);
                saveWebhookEvent(eventId, "usdt", order.getId(), signParams.toString(), "AMOUNT_MISMATCH");
                return "ok";
            }
        }

        // 6. 幂等更新订单状态
        if (order.getStatus() == OrderStatus.PENDING) {
            order.setStatus(OrderStatus.PAID);
            order.setPaidAt(LocalDateTime.now());
            order.setUsdtTxId(blockTxId);
            orderRepository.save(order);
            saveWebhookEvent(eventId, "usdt", order.getId(), signParams.toString(), "SUCCESS");
            log.info("BEpusdt callback: order {} marked as PAID, txid={}", orderId, blockTxId);
        } else {
            saveWebhookEvent(eventId, "usdt", order.getId(), signParams.toString(),
                    "SKIPPED_" + order.getStatus().name());
            log.info("BEpusdt callback: order {} already {}", orderId, order.getStatus());
        }

        return "ok";
    }

    private void saveWebhookEvent(String eventId, String channelCode, UUID orderId,
                                   String payload, String processResult) {
        WebhookEvent event = new WebhookEvent();
        event.setEventId(eventId);
        event.setChannelCode(channelCode);
        event.setOrderId(orderId != null ? orderId : UUID.fromString("00000000-0000-0000-0000-000000000000"));
        event.setPayload(payload);
        event.setProcessResult(processResult);
        webhookEventRepository.save(event);
    }

    /**
     * 从已有 Order 对象查找渠道 config_data 中的 BEpusdt API Token。
     */
    private String resolveBepusdtApiToken(Order order) {
        if (order.getPaymentMethod() != null) {
            PaymentChannel channel = paymentChannelRepository
                    .findByChannelCodeAndIsDeleted(order.getPaymentMethod(), 0)
                    .orElse(null);
            if (channel != null && channel.getConfigData() != null) {
                try {
                    Map<String, Object> cfg = objectMapper.readValue(
                            channel.getConfigData(), new TypeReference<>() {});
                    Object token = cfg.get("api_token");
                    if (token != null && !token.toString().isBlank()) {
                        return token.toString();
                    }
                } catch (Exception e) {
                    log.warn("Failed to parse channel config for api_token: {}", e.getMessage());
                }
            }
        }
        log.warn("Cannot resolve BEpusdt API token for order {}", order.getId());
        return null;
    }

    /**
     * 根据订单的 paymentMethod 查找渠道 config_data 中的 merchant key。
     * 所有配置均从数据库读取，缺失则抛出异常。
     */
    private String resolveMerchantKey(UUID orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order != null && order.getPaymentMethod() != null) {
            PaymentChannel channel = paymentChannelRepository
                    .findByChannelCodeAndIsDeleted(order.getPaymentMethod(), 0)
                    .orElse(null);
            if (channel != null && channel.getConfigData() != null) {
                try {
                    Map<String, Object> cfg = objectMapper.readValue(
                            channel.getConfigData(), new TypeReference<>() {});
                    Object key = cfg.get("key");
                    if (key != null && !key.toString().isBlank()) {
                        return key.toString();
                    }
                } catch (Exception e) {
                    log.warn("Failed to parse channel config for key resolution: {}", e.getMessage());
                }
            }
        }
        log.error("Cannot resolve merchant key for order {}: channel config missing 'key' field", orderId);
        throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE,
                "支付渠道配置缺少 key，请在后台「支付渠道管理」中完善配置");
    }
}
