package com.orionkey.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orionkey.constant.ErrorCode;
import com.orionkey.entity.Order;
import com.orionkey.entity.OrderItem;
import com.orionkey.entity.PaymentChannel;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.OrderItemRepository;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.PaymentChannelRepository;
import com.orionkey.service.BepusdtService;
import com.orionkey.service.BepusdtService.BepusdtConfig;
import com.orionkey.service.BepusdtService.BepusdtPaymentResult;
import com.orionkey.service.EpayService;
import com.orionkey.service.EpayService.ChannelConfig;
import com.orionkey.service.EpayService.EpayResult;
import com.orionkey.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    /** channel_code → 易支付 type 映射（仅 provider_type=epay 时使用） */
    private static final Map<String, String> EPAY_TYPE_MAP = Map.of(
            "alipay", "alipay",
            "wechat", "wxpay"
    );

    private static final String QIUPAY_ALIPAY_CHANNEL_CODE = "qiupay_alipay";

    private final PaymentChannelRepository paymentChannelRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final EpayService epayService;
    private final BepusdtService bepusdtService;
    private final ObjectMapper objectMapper;

    @Override
    public Map<String, Object> createPayment(UUID orderId, String paymentMethod, BigDecimal amount) {
        return createPayment(orderId, paymentMethod, amount, null);
    }

    @Override
    public Map<String, Object> createPayment(UUID orderId, String paymentMethod, BigDecimal amount, String device) {
        // 1. 查找渠道并验证已启用
        PaymentChannel channel = paymentChannelRepository.findByChannelCodeAndIsDeleted(paymentMethod, 0)
                .filter(PaymentChannel::isEnabled)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "支付渠道不可用"));

        // 2. 查找订单
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND, "订单不存在"));

        // 3. 幂等：已有支付URL直接返回（paymentUrl 或 qrcodeUrl 任一存在即可）
        if ((order.getPaymentUrl() != null && !order.getPaymentUrl().isEmpty())
                || (order.getQrcodeUrl() != null && !order.getQrcodeUrl().isEmpty())) {
            log.info("Returning cached payment URL for order: {}", orderId);
            return buildResult(order);
        }

        // 4. 按 providerType 路由到不同的支付实现
        String providerType = channel.getProviderType();
        switch (providerType) {
            case "epay" -> createEpayPayment(channel, order, paymentMethod, amount, device);
            case "qiupay" -> createQiupayPayment(channel, order, paymentMethod, amount, device);
            case "native_alipay" -> throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "原生支付宝支付尚未实现，请使用易支付渠道");
            case "native_wxpay" -> throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "原生微信支付尚未实现，请使用易支付渠道");
            case "usdt" -> createBepusdtPayment(channel, order, amount);
            default -> throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "不支持的支付提供商类型: " + providerType);
        }

        return buildResult(order);
    }

    /**
     * BEpusdt USDT 下单流程
     */
    private void createBepusdtPayment(PaymentChannel channel, Order order, BigDecimal amount) {
        BepusdtConfig config = buildBepusdtConfig(channel);
        String productName = buildProductName(order.getId());

        BepusdtPaymentResult result = bepusdtService.createPayment(
                config, order.getId().toString(), amount, productName);

        order.setPaymentUrl(result.paymentUrl());
        order.setUsdtWalletAddress(result.walletAddress());
        order.setUsdtCryptoAmount(result.cryptoAmount());
        order.setUsdtTradeId(result.tradeId());
        order.setUsdtChain(channel.getChannelCode());
        orderRepository.save(order);
    }

    /**
     * 从渠道的 config_data JSON 构建 BepusdtConfig。
     */
    public BepusdtConfig buildBepusdtConfig(PaymentChannel channel) {
        Map<String, String> cfg = parseConfigData(channel.getConfigData());

        String apiUrl = requireConfig(cfg, "api_url", channel.getChannelCode());
        String apiToken = requireConfig(cfg, "api_token", channel.getChannelCode());
        String notifyUrl = requireConfig(cfg, "notify_url", channel.getChannelCode());
        String redirectUrl = cfg.getOrDefault("redirect_url", "");
        String tradeType = cfg.getOrDefault("trade_type", "usdt.trc20");
        String fiat = cfg.getOrDefault("fiat", "CNY");
        int timeout = Integer.parseInt(cfg.getOrDefault("timeout", "900"));
        BigDecimal tolerance = new BigDecimal(cfg.getOrDefault("auto_approve_tolerance", "0.01"));
        BigDecimal upper = new BigDecimal(cfg.getOrDefault("manual_review_upper", "5.0"));
        String fixedRate = cfg.getOrDefault("fixed_rate", "");

        return new BepusdtConfig(apiUrl, apiToken, notifyUrl, redirectUrl,
                tradeType, fiat, timeout, tolerance, upper, fixedRate);
    }

    /**
     * 易支付下单流程
     */
    private void createEpayPayment(PaymentChannel channel, Order order, String paymentMethod, BigDecimal amount, String device) {
        String epayType = EPAY_TYPE_MAP.get(paymentMethod.toLowerCase());
        if (epayType == null) {
            throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "该渠道不支持易支付");
        }

        ChannelConfig config = buildChannelConfig(channel);
        String productName = buildProductName(order.getId());

        EpayResult epayResult = epayService.createPayment(
                config,
                order.getId().toString(),
                epayType,
                productName,
                amount,
                order.getClientIp(),
                device
        );

        // 分别存储：payUrl 是 H5 跳转链接，qrcodeUrl 是二维码 URL
        order.setPaymentUrl(epayResult.payUrl());
        order.setQrcodeUrl(epayResult.qrcodeUrl());
        order.setEpayTradeNo(epayResult.tradeNo());
        orderRepository.save(order);
    }

    /**
     * Qiupay 下单流程（协议与易支付一致，复用 EpayService 实现）
     */
    private void createQiupayPayment(PaymentChannel channel, Order order, String paymentMethod, BigDecimal amount, String device) {
        if (!QIUPAY_ALIPAY_CHANNEL_CODE.equalsIgnoreCase(paymentMethod)) {
            throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE, "Qiupay 仅支持 qiupay_alipay 渠道");
        }

        ChannelConfig config = buildChannelConfig(channel);
        String productName = buildProductName(order.getId());

        EpayResult epayResult = epayService.createPayment(
                config,
                order.getId().toString(),
                "alipay",
                productName,
                amount,
                order.getClientIp(),
                device
        );

        order.setPaymentUrl(epayResult.payUrl());
        order.setQrcodeUrl(epayResult.qrcodeUrl());
        order.setEpayTradeNo(epayResult.tradeNo());
        orderRepository.save(order);
    }

    /**
     * 从渠道的 config_data JSON 构建 EpayService.ChannelConfig。
     * 所有必填字段均从数据库渠道配置读取，缺失则抛出异常。
     */
    public ChannelConfig buildChannelConfig(PaymentChannel channel) {
        Map<String, String> cfg = parseConfigData(channel.getConfigData());

        String pid = requireConfig(cfg, "pid", channel.getChannelCode());
        String key = requireConfig(cfg, "key", channel.getChannelCode());
        String apiUrl = requireConfig(cfg, "api_url", channel.getChannelCode());
        String notifyUrl = requireConfig(cfg, "notify_url", channel.getChannelCode());
        String returnUrl = requireConfig(cfg, "return_url", channel.getChannelCode());

        return new ChannelConfig(pid, key, apiUrl, notifyUrl, returnUrl);
    }

    private Map<String, Object> buildResult(Order order) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("order_id", order.getId());
        // payment_url: 兼容旧逻辑，优先返回 qrcodeUrl（PC 二维码），fallback 到 paymentUrl（H5 跳转）
        String effectiveUrl = order.getQrcodeUrl() != null ? order.getQrcodeUrl() : order.getPaymentUrl();
        result.put("payment_url", effectiveUrl);
        result.put("qrcode_url", order.getQrcodeUrl());
        result.put("pay_url", order.getPaymentUrl());
        result.put("expires_at", order.getExpiresAt());

        // USDT 支付额外字段
        if (order.getUsdtWalletAddress() != null) {
            result.put("wallet_address", order.getUsdtWalletAddress());
            result.put("crypto_amount", order.getUsdtCryptoAmount());
            result.put("chain", order.getUsdtChain());
        }
        return result;
    }

    private String buildProductName(UUID orderId) {
        List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
        if (items.isEmpty()) return "Orion Key 订单";
        String firstName = items.getFirst().getProductTitle();
        if (items.size() == 1) return firstName;
        return firstName + " 等" + items.size() + "件商品";
    }

    private Map<String, String> parseConfigData(String configData) {
        if (configData == null || configData.isBlank()) return Map.of();
        try {
            Map<String, Object> raw = objectMapper.readValue(configData, new TypeReference<>() {});
            Map<String, String> result = new LinkedHashMap<>();
            for (var entry : raw.entrySet()) {
                if (entry.getValue() != null) {
                    result.put(entry.getKey(), entry.getValue().toString());
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Failed to parse channel config_data: {}", e.getMessage());
            return Map.of();
        }
    }

    /** repay 最小间隔（秒），防止频繁调用冲击支付网关 */
    private static final int REPAY_COOLDOWN_SECONDS = 10;

    @Override
    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> repay(UUID orderId, String device, UUID requestUserId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND, "订单不存在"));

        // F9: 归属校验 — 已登录用户只能 repay 自己的订单
        if (order.getUserId() != null && requestUserId != null
                && !order.getUserId().equals(requestUserId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权操作此订单");
        }

        if (order.getStatus() != com.orionkey.constant.OrderStatus.PENDING) {
            throw new BusinessException(ErrorCode.ORDER_EXPIRED, "订单状态不允许重新支付");
        }

        if (order.getExpiresAt().isBefore(java.time.LocalDateTime.now())) {
            order.setStatus(com.orionkey.constant.OrderStatus.EXPIRED);
            orderRepository.save(order);
            throw new BusinessException(ErrorCode.ORDER_EXPIRED, "订单已过期");
        }

        // 频率限制：距上次更新不足 REPAY_COOLDOWN_SECONDS 秒则拒绝
        if (order.getUpdatedAt() != null
                && order.getUpdatedAt().plusSeconds(REPAY_COOLDOWN_SECONDS).isAfter(java.time.LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "操作过于频繁，请稍后再试");
        }

        // 清除旧支付信息，跳过幂等缓存
        order.setPaymentUrl(null);
        order.setQrcodeUrl(null);
        order.setEpayTradeNo(null);
        orderRepository.save(order);

        // 重新创建支付
        return createPayment(order.getId(), order.getPaymentMethod(), order.getActualAmount(), device);
    }

    private static String requireConfig(Map<String, String> cfg, String field, String channelCode) {
        String value = cfg.get(field);
        if (value == null || value.isBlank()) {
            throw new BusinessException(ErrorCode.CHANNEL_UNAVAILABLE,
                    "支付渠道 [" + channelCode + "] 缺少必填配置项: " + field + "，请在后台「支付渠道管理」中完善配置");
        }
        return value;
    }
}
