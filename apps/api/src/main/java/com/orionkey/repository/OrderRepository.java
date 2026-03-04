package com.orionkey.repository;

import com.orionkey.constant.OrderStatus;
import com.orionkey.constant.OrderType;
import com.orionkey.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    Optional<Order> findByUsdtTxId(String usdtTxId);

    Page<Order> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<Order> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, OrderStatus status, Pageable pageable);

    List<Order> findByEmailInOrderByCreatedAtDesc(List<String> emails);

    List<Order> findByIdIn(List<UUID> ids);

    @Query("SELECT o FROM Order o WHERE o.status = com.orionkey.constant.OrderStatus.PENDING AND o.expiresAt < :now")
    List<Order> findExpiredOrders(@Param("now") LocalDateTime now);

    long countByUserIdAndStatus(UUID userId, OrderStatus status);

    long countByClientIpAndStatus(String clientIp, OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.riskFlagged = true ORDER BY o.createdAt DESC")
    Page<Order> findRiskFlaggedOrders(Pageable pageable);

    // Dashboard aggregate queries
    @Query("SELECT COALESCE(SUM(o.actualAmount), 0) FROM Order o WHERE (o.status = com.orionkey.constant.OrderStatus.PAID OR o.status = com.orionkey.constant.OrderStatus.DELIVERED) AND o.paidAt >= :since")
    BigDecimal sumSalesSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(o) FROM Order o WHERE (o.status = com.orionkey.constant.OrderStatus.PAID OR o.status = com.orionkey.constant.OrderStatus.DELIVERED) AND o.paidAt >= :since")
    long countPaidOrdersSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(o) FROM Order o WHERE (o.status = com.orionkey.constant.OrderStatus.PAID OR o.status = com.orionkey.constant.OrderStatus.DELIVERED)")
    long countTotalPaidOrders();

    long count();

    // 管理后台订单列表 — 无搜索词
    @Query("SELECT o FROM Order o WHERE " +
            "(:status IS NULL OR o.status = :status) " +
            "AND (:orderType IS NULL OR o.orderType = :orderType) " +
            "AND (:paymentMethod IS NULL OR o.paymentMethod = :paymentMethod) " +
            "AND (:isRiskFlagged IS NULL OR o.riskFlagged = :isRiskFlagged) " +
            "ORDER BY o.createdAt DESC")
    Page<Order> findAdminOrders(@Param("status") OrderStatus status,
                                @Param("orderType") OrderType orderType,
                                @Param("paymentMethod") String paymentMethod,
                                @Param("isRiskFlagged") Boolean isRiskFlagged,
                                Pageable pageable);

    // 管理后台订单列表 — 带搜索词（按订单ID或邮箱搜索，keyword 保证非 null）
    @Query("SELECT o FROM Order o WHERE " +
            "(:status IS NULL OR o.status = :status) " +
            "AND (:orderType IS NULL OR o.orderType = :orderType) " +
            "AND (:paymentMethod IS NULL OR o.paymentMethod = :paymentMethod) " +
            "AND (:isRiskFlagged IS NULL OR o.riskFlagged = :isRiskFlagged) " +
            "AND (str(o.id) LIKE :keywordPattern OR o.email LIKE :keywordPattern) " +
            "ORDER BY o.createdAt DESC")
    Page<Order> findAdminOrdersByKeyword(@Param("status") OrderStatus status,
                                         @Param("orderType") OrderType orderType,
                                         @Param("paymentMethod") String paymentMethod,
                                         @Param("isRiskFlagged") Boolean isRiskFlagged,
                                         @Param("keywordPattern") String keywordPattern,
                                         Pageable pageable);
}
