package com.orionkey.service.impl;

import com.orionkey.constant.CardKeyStatus;
import com.orionkey.constant.ErrorCode;
import com.orionkey.constant.OrderStatus;
import com.orionkey.constant.OrderType;
import com.orionkey.entity.*;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.*;
import com.orionkey.service.OrderService;
import com.orionkey.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final ProductSpecRepository productSpecRepository;
    private final WholesaleRuleRepository wholesaleRuleRepository;
    private final CartItemRepository cartItemRepository;
    private final CardKeyRepository cardKeyRepository;
    private final SiteConfigRepository siteConfigRepository;
    private final PaymentService paymentService;

    @Override
    @Transactional
    public Map<String, Object> createDirectOrder(Map<String, Object> req, UUID userId, String clientIp, String sessionToken) {
        String idempotencyKey = (String) req.get("idempotency_key");
        if (idempotencyKey != null) {
            Optional<Order> existing = orderRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return buildOrderResult(existing.get());
            }
        }

        checkPendingOrderLimits(userId, clientIp);

        UUID productId = UUID.fromString((String) req.get("product_id"));
        UUID specId = req.get("spec_id") != null ? UUID.fromString((String) req.get("spec_id")) : null;
        int quantity = ((Number) req.get("quantity")).intValue();
        String email = (String) req.get("email");
        String paymentMethod = (String) req.get("payment_method");

        Product product = productRepository.findById(productId)
                .filter(p -> p.getIsDeleted() == 0 && p.isEnabled())
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND, "商品不存在或已下架"));

        // Stock check (advisory)
        long available = specId != null
                ? cardKeyRepository.countByProductIdAndSpecIdAndStatus(productId, specId, CardKeyStatus.AVAILABLE)
                : cardKeyRepository.countByProductIdAndSpecIdIsNullAndStatus(productId, CardKeyStatus.AVAILABLE);
        if (available < quantity) {
            throw new BusinessException(ErrorCode.INSUFFICIENT_STOCK, "库存不足");
        }

        BigDecimal unitPrice = getUnitPrice(product, specId, quantity);
        BigDecimal totalAmount = unitPrice.multiply(BigDecimal.valueOf(quantity));
        int expireMinutes = getConfigInt("order_expire_minutes", 15);

        Order order = new Order();
        order.setUserId(userId);
        order.setEmail(email);
        order.setTotalAmount(totalAmount);
        order.setActualAmount(totalAmount);
        order.setStatus(OrderStatus.PENDING);
        order.setOrderType(OrderType.DIRECT);
        order.setPaymentMethod(paymentMethod);
        order.setExpiresAt(LocalDateTime.now().plusMinutes(expireMinutes));
        order.setIdempotencyKey(idempotencyKey);
        order.setClientIp(clientIp);
        order.setSessionToken(sessionToken);
        orderRepository.save(order);

        String specName = null;
        if (specId != null) {
            ProductSpec spec = productSpecRepository.findById(specId).orElse(null);
            specName = spec != null ? spec.getName() : null;
        }

        OrderItem item = new OrderItem();
        item.setOrderId(order.getId());
        item.setProductId(productId);
        item.setSpecId(specId);
        item.setProductTitle(product.getTitle());
        item.setSpecName(specName);
        item.setQuantity(quantity);
        item.setUnitPrice(unitPrice);
        item.setSubtotal(totalAmount);
        orderItemRepository.save(item);

        return buildOrderResult(order);
    }

    @Override
    @Transactional
    public Map<String, Object> createCartOrder(Map<String, Object> req, UUID userId, String clientIp, String sessionToken) {
        String idempotencyKey = (String) req.get("idempotency_key");
        if (idempotencyKey != null) {
            Optional<Order> existing = orderRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return buildOrderResult(existing.get());
            }
        }

        checkPendingOrderLimits(userId, clientIp);

        String email = (String) req.get("email");
        String paymentMethod = (String) req.get("payment_method");

        List<CartItem> cartItems;
        if (userId != null) {
            cartItems = cartItemRepository.findByUserId(userId);
        } else if (sessionToken != null) {
            cartItems = cartItemRepository.findBySessionToken(sessionToken);
        } else {
            cartItems = List.of();
        }
        if (cartItems.isEmpty()) {
            throw new BusinessException(ErrorCode.CART_EMPTY, "购物车为空");
        }

        int expireMinutes = getConfigInt("order_expire_minutes", 15);
        BigDecimal totalAmount = BigDecimal.ZERO;

        Order order = new Order();
        order.setUserId(userId);
        order.setEmail(email);
        order.setStatus(OrderStatus.PENDING);
        order.setOrderType(OrderType.CART);
        order.setPaymentMethod(paymentMethod);
        order.setExpiresAt(LocalDateTime.now().plusMinutes(expireMinutes));
        order.setIdempotencyKey(idempotencyKey);
        order.setClientIp(clientIp);
        order.setSessionToken(sessionToken);
        orderRepository.save(order);

        for (CartItem ci : cartItems) {
            Product product = productRepository.findById(ci.getProductId())
                    .filter(p -> p.getIsDeleted() == 0 && p.isEnabled())
                    .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND, "商品不存在或已下架"));

            BigDecimal unitPrice = getUnitPrice(product, ci.getSpecId(), ci.getQuantity());
            BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(ci.getQuantity()));
            totalAmount = totalAmount.add(subtotal);

            String specName = null;
            if (ci.getSpecId() != null) {
                ProductSpec spec = productSpecRepository.findById(ci.getSpecId()).orElse(null);
                specName = spec != null ? spec.getName() : null;
            }

            OrderItem item = new OrderItem();
            item.setOrderId(order.getId());
            item.setProductId(ci.getProductId());
            item.setSpecId(ci.getSpecId());
            item.setProductTitle(product.getTitle());
            item.setSpecName(specName);
            item.setQuantity(ci.getQuantity());
            item.setUnitPrice(unitPrice);
            item.setSubtotal(subtotal);
            orderItemRepository.save(item);
        }

        order.setTotalAmount(totalAmount);
        order.setActualAmount(totalAmount);
        orderRepository.save(order);

        // Clear cart
        for (CartItem ci : cartItems) {
            cartItemRepository.delete(ci);
        }

        return buildOrderResult(order);
    }

    @Override
    @Transactional
    public Map<String, Object> getOrderStatus(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND, "订单不存在"));
        // Auto expire check
        if (order.getStatus() == OrderStatus.PENDING && order.getExpiresAt().isBefore(LocalDateTime.now())) {
            order.setStatus(OrderStatus.EXPIRED);
            orderRepository.save(order);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("order_id", order.getId());
        result.put("status", order.getStatus().name());
        result.put("expires_at", order.getExpiresAt());
        return result;
    }

    @Override
    public Map<String, Object> refreshOrderStatus(UUID orderId) {
        // In a real implementation, this would query the payment provider
        return getOrderStatus(orderId);
    }

    @Override
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void expireOrders() {
        List<Order> expired = orderRepository.findExpiredOrders(LocalDateTime.now());
        for (Order order : expired) {
            order.setStatus(OrderStatus.EXPIRED);
            orderRepository.save(order);
            log.info("Order expired: {}", order.getId());
        }
    }

    private BigDecimal getUnitPrice(Product product, UUID specId, int quantity) {
        BigDecimal basePrice = product.getBasePrice();
        if (specId != null) {
            ProductSpec spec = productSpecRepository.findById(specId).orElse(null);
            if (spec != null) basePrice = spec.getPrice();
        }

        if (product.isWholesaleEnabled()) {
            List<WholesaleRule> rules;
            if (specId != null) {
                rules = wholesaleRuleRepository.findByProductIdAndSpecIdOrderByMinQuantityAsc(product.getId(), specId);
            } else {
                rules = wholesaleRuleRepository.findByProductIdAndSpecIdIsNullOrderByMinQuantityAsc(product.getId());
            }
            // Find matching tier (highest minQuantity <= quantity)
            for (int i = rules.size() - 1; i >= 0; i--) {
                if (quantity >= rules.get(i).getMinQuantity()) {
                    return rules.get(i).getUnitPrice();
                }
            }
        }
        return basePrice;
    }

    private void checkPendingOrderLimits(UUID userId, String clientIp) {
        int maxPerUser = getConfigInt("max_pending_orders_per_user", 5);
        int maxPerIp = getConfigInt("max_pending_orders_per_ip", 10);

        if (userId != null) {
            long pending = orderRepository.countByUserIdAndStatus(userId, OrderStatus.PENDING);
            if (pending >= maxPerUser) {
                throw new BusinessException(ErrorCode.UNPAID_ORDER_EXISTS, "您有未支付的订单，请先完成支付或等待过期");
            }
        }
        if (clientIp != null) {
            long pending = orderRepository.countByClientIpAndStatus(clientIp, OrderStatus.PENDING);
            if (pending >= maxPerIp) {
                throw new BusinessException(ErrorCode.UNPAID_ORDER_EXISTS, "您有未支付的订单，请先完成支付或等待过期");
            }
        }
    }

    private Map<String, Object> buildOrderResult(Order order) {
        List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
        Map<String, Object> orderDetail = toOrderDetail(order, items);
        Map<String, Object> payment = paymentService.createPayment(
                order.getId(), order.getPaymentMethod(), order.getActualAmount());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("order", orderDetail);
        result.put("payment", payment);
        return result;
    }

    private Map<String, Object> toOrderDetail(Order o, List<OrderItem> items) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", o.getId());
        map.put("total_amount", o.getTotalAmount());
        map.put("actual_amount", o.getActualAmount());
        map.put("status", o.getStatus().name());
        map.put("order_type", o.getOrderType().name());
        map.put("payment_method", o.getPaymentMethod());
        map.put("created_at", o.getCreatedAt());
        map.put("email", o.getEmail());
        map.put("points_deducted", o.getPointsDeducted());
        map.put("points_discount", o.getPointsDiscount());
        map.put("expires_at", o.getExpiresAt());
        map.put("paid_at", o.getPaidAt());
        map.put("delivered_at", o.getDeliveredAt());
        map.put("items", items.stream().map(i -> {
            Map<String, Object> im = new LinkedHashMap<>();
            im.put("id", i.getId());
            im.put("product_id", i.getProductId());
            im.put("product_title", i.getProductTitle());
            im.put("spec_name", i.getSpecName());
            im.put("quantity", i.getQuantity());
            im.put("unit_price", i.getUnitPrice());
            im.put("subtotal", i.getSubtotal());
            return im;
        }).toList());
        return map;
    }

    private int getConfigInt(String key, int defaultValue) {
        return siteConfigRepository.findByConfigKey(key)
                .map(c -> {
                    try { return Integer.parseInt(c.getConfigValue()); }
                    catch (Exception e) { return defaultValue; }
                }).orElse(defaultValue);
    }
}
