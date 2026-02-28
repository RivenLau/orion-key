package com.orionkey.service.impl;

import com.orionkey.constant.CardKeyStatus;
import com.orionkey.constant.ErrorCode;
import com.orionkey.constant.OrderStatus;
import com.orionkey.entity.*;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.*;
import com.orionkey.service.DeliverService;
import com.orionkey.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeliverServiceImpl implements DeliverService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CardKeyRepository cardKeyRepository;
    private final UserRepository userRepository;
    private final PointsLogRepository pointsLogRepository;
    private final SiteConfigRepository siteConfigRepository;
    private final EmailService emailService;

    @Override
    @SuppressWarnings("unchecked")
    public List<?> queryOrders(Map<String, Object> request) {
        Set<UUID> orderIds = new LinkedHashSet<>();

        List<String> orderIdStrs = (List<String>) request.get("order_ids");
        if (orderIdStrs != null) {
            orderIdStrs.forEach(id -> orderIds.add(UUID.fromString(id)));
        }

        List<String> emails = (List<String>) request.get("emails");
        if (emails != null && !emails.isEmpty()) {
            List<Order> emailOrders = orderRepository.findByEmailInOrderByCreatedAtDesc(emails);
            emailOrders.forEach(o -> orderIds.add(o.getId()));
        }

        if (orderIds.isEmpty()) {
            throw new BusinessException(ErrorCode.ORDER_NOT_FOUND, "订单不存在");
        }

        List<Order> orders = orderRepository.findByIdIn(new ArrayList<>(orderIds));
        // Sort by createdAt desc
        orders.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));

        return orders.stream().map(o -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", o.getId());
            map.put("total_amount", o.getTotalAmount());
            map.put("actual_amount", o.getActualAmount());
            map.put("status", o.getStatus().name());
            map.put("order_type", o.getOrderType().name());
            map.put("payment_method", o.getPaymentMethod());
            map.put("created_at", o.getCreatedAt());
            return map;
        }).toList();
    }

    @Override
    @SuppressWarnings("unchecked")
    @Transactional
    public List<?> deliverOrders(Map<String, Object> request) {
        List<String> orderIdStrs = (List<String>) request.get("order_ids");
        if (orderIdStrs == null || orderIdStrs.isEmpty()) {
            throw new BusinessException(ErrorCode.ORDER_NOT_FOUND, "订单不存在");
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (String idStr : orderIdStrs) {
            UUID orderId = UUID.fromString(idStr);
            results.add(deliverSingleOrder(orderId));
        }
        return results;
    }

    private Map<String, Object> deliverSingleOrder(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND, "订单不存在"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("order_id", orderId);

        switch (order.getStatus()) {
            case DELIVERED -> {
                result.put("status", "DELIVERED");
                result.put("groups", buildCardKeyGroups(orderId));
            }
            case PAID -> {
                List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
                try {
                    List<CardKey> allAllocated = new ArrayList<>();
                    for (OrderItem item : items) {
                        List<CardKey> keys = cardKeyRepository.findAndLockAvailable(
                                item.getProductId(), item.getSpecId(), item.getQuantity());
                        if (keys.size() < item.getQuantity()) {
                            throw new BusinessException(ErrorCode.ORDER_OUT_OF_STOCK, "缺货补货中，请联系客服");
                        }
                        for (CardKey key : keys) {
                            key.setStatus(CardKeyStatus.SOLD);
                            key.setOrderId(orderId);
                            key.setOrderItemId(item.getId());
                            key.setSoldAt(LocalDateTime.now());
                            cardKeyRepository.save(key);
                        }
                        allAllocated.addAll(keys);
                    }

                    order.setStatus(OrderStatus.DELIVERED);
                    order.setDeliveredAt(LocalDateTime.now());
                    orderRepository.save(order);

                    // Award points
                    awardPoints(order);

                    // Send delivery email after transaction commits (async, non-blocking)
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            emailService.sendDeliveryEmail(orderId);
                        }
                    });

                    result.put("status", "DELIVERED");
                    result.put("groups", buildCardKeyGroups(orderId));
                } catch (BusinessException e) {
                    result.put("status", "PAID");
                    result.put("groups", List.of());
                    log.warn("Deliver failed for order {}: {}", orderId, e.getMessage());
                }
            }
            case PENDING -> {
                result.put("status", "PENDING");
                result.put("groups", List.of());
            }
            case EXPIRED -> {
                result.put("status", "EXPIRED");
                result.put("groups", List.of());
            }
        }
        return result;
    }

    @Override
    public String exportCardKeys(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND, "订单不存在"));
        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.ORDER_NOT_PAID, "订单未发货");
        }

        List<CardKey> keys = cardKeyRepository.findByOrderId(orderId);
        List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
        Map<UUID, OrderItem> itemMap = items.stream().collect(Collectors.toMap(OrderItem::getId, i -> i));

        StringBuilder sb = new StringBuilder();
        sb.append("订单号: ").append(orderId).append("\n");
        sb.append("=".repeat(40)).append("\n\n");

        Map<UUID, List<CardKey>> grouped = keys.stream()
                .filter(k -> k.getOrderItemId() != null)
                .collect(Collectors.groupingBy(CardKey::getOrderItemId));

        for (Map.Entry<UUID, List<CardKey>> entry : grouped.entrySet()) {
            OrderItem item = itemMap.get(entry.getKey());
            if (item != null) {
                sb.append("商品: ").append(item.getProductTitle());
                if (item.getSpecName() != null) sb.append(" [").append(item.getSpecName()).append("]");
                sb.append("\n");
                for (CardKey key : entry.getValue()) {
                    sb.append(key.getContent()).append("\n");
                }
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    private List<Map<String, Object>> buildCardKeyGroups(UUID orderId) {
        List<CardKey> keys = cardKeyRepository.findByOrderId(orderId);
        List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
        Map<UUID, OrderItem> itemMap = items.stream().collect(Collectors.toMap(OrderItem::getId, i -> i));

        Map<UUID, List<CardKey>> grouped = keys.stream()
                .filter(k -> k.getOrderItemId() != null)
                .collect(Collectors.groupingBy(CardKey::getOrderItemId));

        List<Map<String, Object>> groups = new ArrayList<>();
        for (Map.Entry<UUID, List<CardKey>> entry : grouped.entrySet()) {
            OrderItem item = itemMap.get(entry.getKey());
            if (item != null) {
                Map<String, Object> g = new LinkedHashMap<>();
                g.put("product_title", item.getProductTitle());
                g.put("spec_name", item.getSpecName());
                g.put("card_keys", entry.getValue().stream().map(CardKey::getContent).toList());
                groups.add(g);
            }
        }
        return groups;
    }

    private void awardPoints(Order order) {
        if (order.getUserId() == null) return;
        boolean pointsEnabled = siteConfigRepository.findByConfigKey("points_enabled")
                .map(c -> "true".equalsIgnoreCase(c.getConfigValue()))
                .orElse(false);
        if (!pointsEnabled) return;

        int pointsRate = siteConfigRepository.findByConfigKey("points_rate")
                .map(c -> { try { return Integer.parseInt(c.getConfigValue()); } catch (Exception e) { return 0; } })
                .orElse(0);
        if (pointsRate <= 0) return;

        int pointsEarned = order.getActualAmount().multiply(java.math.BigDecimal.valueOf(pointsRate))
                .setScale(0, java.math.RoundingMode.FLOOR).intValue();
        if (pointsEarned <= 0) return;

        User user = userRepository.findById(order.getUserId()).orElse(null);
        if (user == null) return;

        user.setPoints(user.getPoints() + pointsEarned);
        userRepository.save(user);

        PointsLog log = new PointsLog();
        log.setUserId(user.getId());
        log.setChangeAmount(pointsEarned);
        log.setBalanceAfter(user.getPoints());
        log.setReason("购物奖励积分");
        log.setOrderId(order.getId());
        pointsLogRepository.save(log);
    }
}
