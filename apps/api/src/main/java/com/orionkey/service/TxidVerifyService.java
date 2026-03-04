package com.orionkey.service;

import com.orionkey.entity.Order;

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
}
