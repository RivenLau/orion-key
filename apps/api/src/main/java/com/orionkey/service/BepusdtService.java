package com.orionkey.service;

import java.math.BigDecimal;
import java.util.Map;

public interface BepusdtService {

    /**
     * BEpusdt 渠道配置（从 PaymentChannel.configData 解析）
     */
    record BepusdtConfig(
            String apiUrl,                   // BEpusdt 服务地址
            String apiToken,                 // API 密钥（用于签名）
            String notifyUrl,                // Webhook 回调地址
            String redirectUrl,              // 支付成功跳转地址
            String tradeType,                // 交易类型，如 usdt.trc20 / usdt.bep20
            String fiat,                     // 法币类型，默认 CNY
            int timeout,                     // 超时秒数，默认 900
            String fixedRate                 // 固定汇率（留空则使用 BEpusdt 动态汇率），如 "7.2"
    ) {}

    /**
     * 支付结果
     */
    record BepusdtPaymentResult(
            String tradeId,        // BEpusdt 系统交易 ID
            String walletAddress,  // 收款钱包地址
            String cryptoAmount,   // 精确加密货币金额（3 位小数）
            String paymentUrl,     // BEpusdt 托管支付页 URL（备用）
            int expirationTime     // 超时秒数
    ) {}

    /**
     * 创建 USDT 支付
     */
    BepusdtPaymentResult createPayment(BepusdtConfig config, String orderId, BigDecimal amount, String productName);

    /**
     * 生成 MD5 签名（BEpusdt 兼容易支付签名协议）
     */
    String buildSign(String apiToken, Map<String, String> params);

    /**
     * 验证 Webhook 签名
     */
    boolean verifySign(String apiToken, Map<String, String> params, String signature);
}
