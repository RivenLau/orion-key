package com.orionkey.service.impl;

import com.orionkey.common.PageResult;
import com.orionkey.entity.Order;
import com.orionkey.entity.SiteConfig;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.SiteConfigRepository;
import com.orionkey.service.RiskConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RiskConfigServiceImpl implements RiskConfigService {

    private final SiteConfigRepository siteConfigRepository;
    private final OrderRepository orderRepository;

    private static final List<String> RISK_KEYS = List.of(
            "rate_limit_per_second", "login_attempt_limit", "max_purchase_per_user",
            "max_pending_orders_per_ip", "max_pending_orders_per_user", "order_expire_minutes"
    );

    @Override
    public Map<String, Object> getRiskConfig() {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String key : RISK_KEYS) {
            siteConfigRepository.findByConfigKey(key).ifPresent(c -> {
                try { result.put(key, Integer.parseInt(c.getConfigValue())); }
                catch (NumberFormatException e) { result.put(key, c.getConfigValue()); }
            });
        }
        return result;
    }

    @Override
    @Transactional
    public void updateRiskConfig(Map<String, Object> request) {
        for (String key : RISK_KEYS) {
            if (request.containsKey(key)) {
                SiteConfig config = siteConfigRepository.findByConfigKey(key)
                        .orElseGet(() -> {
                            SiteConfig c = new SiteConfig();
                            c.setConfigKey(key);
                            c.setConfigGroup("risk");
                            return c;
                        });
                config.setConfigValue(request.get(key).toString());
                siteConfigRepository.save(config);
            }
        }
    }

    @Override
    public PageResult<?> getFlaggedOrders(int page, int pageSize) {
        var pageable = PageRequest.of(page - 1, pageSize);
        Page<Order> orderPage = orderRepository.findRiskFlaggedOrders(pageable);
        var list = orderPage.getContent().stream().map(o -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", o.getId());
            map.put("total_amount", o.getTotalAmount());
            map.put("actual_amount", o.getActualAmount());
            map.put("status", o.getStatus().name());
            map.put("order_type", o.getOrderType().name());
            map.put("payment_method", o.getPaymentMethod());
            map.put("created_at", o.getCreatedAt());
            map.put("email", o.getEmail());
            map.put("user_id", o.getUserId());
            map.put("is_risk_flagged", o.isRiskFlagged());
            return map;
        }).toList();
        return PageResult.of(orderPage, list);
    }
}
