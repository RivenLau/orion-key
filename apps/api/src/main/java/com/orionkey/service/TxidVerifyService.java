package com.orionkey.service;

import com.orionkey.entity.Order;

import java.time.LocalDateTime;

public interface TxidVerifyService {

    enum VerifyResult {
        AUTO_APPROVED,      // 自动通过：链上验证全部通过
        AUTO_REJECTED,      // 自动拒绝：硬性条件不满足
        PENDING_REVIEW      // 转人工：边缘情况
    }

    record VerifyDetail(
            VerifyResult result,
            String reason,           // 原因说明
            String onChainFrom,      // 链上发送方地址
            String onChainTo,        // 链上接收方地址
            String onChainAmount,    // 链上实际金额
            boolean confirmed        // 交易是否已确认
    ) {}

    /**
     * 验证 TXID 并处理订单
     */
    VerifyDetail verifyAndProcess(Order order, String txid);

    /**
     * Webhook 回调链上验证（轻量级）：验证 TXID 对应的链上交易是否真实且匹配订单。
     * 与 verifyAndProcess 不同，本方法不修改订单状态、不写 unmatched_transactions 表。
     *
     * @return 验证通过/失败的结果；null 表示链上 API 查询失败（调用方应触发重试）
     */
    ChainVerifyResult verifyForWebhook(String chain, String txid,
                                        String expectedWalletAddress, String expectedCryptoAmount,
                                        LocalDateTime orderCreatedAt);

    record ChainVerifyResult(boolean verified, String reason) {}
}
