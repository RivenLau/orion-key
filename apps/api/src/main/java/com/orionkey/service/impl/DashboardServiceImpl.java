package com.orionkey.service.impl;

import com.orionkey.constant.CardKeyStatus;
import com.orionkey.constant.OrderStatus;
import com.orionkey.entity.Order;
import com.orionkey.entity.Product;
import com.orionkey.entity.VisitStats;
import com.orionkey.repository.*;
import com.orionkey.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CardKeyRepository cardKeyRepository;
    private final VisitStatsRepository visitStatsRepository;
    private final ProductSpecRepository productSpecRepository;

    @Override
    public Map<String, Object> getStats() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();

        // Use aggregate queries instead of loading all orders
        BigDecimal todaySales = orderRepository.sumSalesSince(todayStart);
        BigDecimal monthSales = orderRepository.sumSalesSince(monthStart);
        long todayOrders = orderRepository.countPaidOrdersSince(todayStart);
        long monthOrders = orderRepository.countPaidOrdersSince(monthStart);
        long totalPaid = orderRepository.countTotalPaidOrders();
        long totalCreated = orderRepository.count();

        double conversionRate = totalCreated > 0 ? (double) totalPaid / totalCreated * 100 : 0;

        VisitStats todayVisit = visitStatsRepository.findByVisitDate(LocalDate.now()).orElse(null);

        // Low stock products — count ALL available keys per product (across all specs)
        List<Product> products = productRepository.findAll().stream()
                .filter(p -> p.getIsDeleted() == 0 && p.isEnabled())
                .toList();
        List<Map<String, Object>> lowStock = new ArrayList<>();
        for (Product p : products) {
            long available = cardKeyRepository.countByProductIdAndStatus(p.getId(), CardKeyStatus.AVAILABLE);
            if (available <= p.getLowStockThreshold()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("product_id", p.getId());
                m.put("title", p.getTitle());
                m.put("available_stock", available);
                m.put("threshold", p.getLowStockThreshold());
                lowStock.add(m);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("today_sales", todaySales);
        result.put("month_sales", monthSales);
        result.put("today_orders", todayOrders);
        result.put("month_orders", monthOrders);
        result.put("conversion_rate", Math.round(conversionRate * 100.0) / 100.0);
        result.put("today_pv", todayVisit != null ? todayVisit.getPv() : 0);
        result.put("today_uv", todayVisit != null ? todayVisit.getUv() : 0);
        result.put("low_stock_products", lowStock);
        return result;
    }

    @Override
    public List<?> getSalesTrend(String period, String startDate, String endDate) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : LocalDate.now().minusDays(30);
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();

        // Still load filtered orders for trend grouping, but with date range filter
        LocalDateTime startDt = start.atStartOfDay();
        LocalDateTime endDt = end.plusDays(1).atStartOfDay();

        List<Order> orders = orderRepository.findAll().stream()
                .filter(o -> (o.getStatus() == OrderStatus.PAID || o.getStatus() == OrderStatus.DELIVERED) && o.getPaidAt() != null)
                .filter(o -> !o.getPaidAt().isBefore(startDt) && o.getPaidAt().isBefore(endDt))
                .toList();

        Map<String, BigDecimal> salesMap = new TreeMap<>();
        Map<String, Integer> countMap = new TreeMap<>();

        for (Order o : orders) {
            String key;
            if ("monthly".equals(period)) {
                key = o.getPaidAt().toLocalDate().withDayOfMonth(1).toString().substring(0, 7);
            } else {
                key = o.getPaidAt().toLocalDate().toString();
            }
            salesMap.merge(key, o.getActualAmount() != null ? o.getActualAmount() : BigDecimal.ZERO, BigDecimal::add);
            countMap.merge(key, 1, Integer::sum);
        }

        return salesMap.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.getKey());
            m.put("sales_amount", e.getValue());
            m.put("order_count", countMap.getOrDefault(e.getKey(), 0));
            return m;
        }).collect(Collectors.toList());
    }
}
