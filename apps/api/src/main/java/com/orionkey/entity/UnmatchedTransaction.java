package com.orionkey.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "unmatched_transactions", indexes = {
        @Index(name = "idx_unmatched_tx_status", columnList = "status"),
        @Index(name = "idx_unmatched_tx_order", columnList = "orderId")
})
public class UnmatchedTransaction extends BaseEntity {

    private UUID orderId;

    @Column(nullable = false, unique = true)
    private String txid;

    private String chain;

    // ── 链上验证结果（自动填充） ──

    /** 链上发送方地址 */
    private String onChainFrom;

    /** 链上接收方地址 */
    private String onChainTo;

    /** 链上实际金额 */
    private String onChainAmount;

    /** 订单预期金额 */
    private String expectedAmount;

    /** 金额差额 */
    private String amountDiff;

    // ── 审核信息 ──

    /** USER_SUBMIT / SYSTEM_DETECT */
    @Column(nullable = false)
    private String source = "USER_SUBMIT";

    /** AUTO_APPROVED / AUTO_REJECTED / PENDING_REVIEW / APPROVED / REJECTED */
    @Column(nullable = false)
    private String status = "PENDING_REVIEW";

    /** 自动审核/人工审核原因 */
    @Column(length = 512)
    private String verifyReason;

    /** 人工审核人（自动审核时为空） */
    private UUID reviewerId;

    /** 人工审核时间 */
    private LocalDateTime reviewedAt;

    /** 用户提交时间 */
    @Column(nullable = false)
    private LocalDateTime submittedAt;
}
