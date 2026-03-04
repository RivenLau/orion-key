package com.orionkey.entity;

import com.orionkey.constant.OrderStatus;
import com.orionkey.constant.OrderType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "orders")
public class Order extends BaseEntity {

    private UUID userId;

    private String email;

    @Column(precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(precision = 10, scale = 2)
    private BigDecimal actualAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderType orderType;

    private String paymentMethod;

    private int pointsDeducted = 0;

    @Column(precision = 10, scale = 2)
    private BigDecimal pointsDiscount = BigDecimal.ZERO;

    private LocalDateTime expiresAt;

    private LocalDateTime paidAt;

    private LocalDateTime deliveredAt;

    @Column(unique = true)
    private String idempotencyKey;

    @Column(name = "is_risk_flagged")
    private boolean riskFlagged = false;

    private String clientIp;

    private String sessionToken;

    @Column(columnDefinition = "TEXT")
    private String paymentUrl;

    @Column(columnDefinition = "TEXT")
    private String qrcodeUrl;

    private String epayTradeNo;

    // ── USDT 支付字段 ──

    /** 收款钱包地址 */
    private String usdtWalletAddress;

    /** 精确加密货币金额（3 位小数） */
    private String usdtCryptoAmount;

    /** BEpusdt 交易 ID */
    private String usdtTradeId;

    /** 链标识，如 usdt_trc20 / usdt_bep20 */
    private String usdtChain;

    /** 链上交易哈希（支付成功后填充） */
    @Column(unique = true)
    private String usdtTxId;
}
