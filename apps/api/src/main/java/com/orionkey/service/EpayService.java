package com.orionkey.service;

import java.math.BigDecimal;
import java.util.Map;

public interface EpayService {

    /**
     * 易支付渠道配置（从管理后台配置读取，或从 application.yml 默认值）
     */
    record ChannelConfig(String pid, String key, String apiUrl, String notifyUrl, String returnUrl) {}

    /**
     * 调用易支付 /mapi.php 创建支付订单
     *
     * @param config     渠道配置（pid/key/apiUrl 等）
     * @param outTradeNo 商户订单号（Order UUID）
     * @param type       易支付支付类型：alipay / wxpay
     * @param name       商品名称
     * @param money      金额
     * @param clientIp   用户 IP
     * @return 包含 payUrl / qrcodeUrl 的结果
     */
    EpayResult createPayment(ChannelConfig config, String outTradeNo, String type, String name, BigDecimal money, String clientIp, String device);

    /**
     * 生成 MD5 签名
     */
    String buildSign(String merchantKey, Map<String, String> params);

    /**
     * 验证回调签名
     */
    boolean verifySign(String merchantKey, Map<String, String> params, String sign);

    /**
     * 主动查询网关订单状态（用于 webhook 回调二次验证）
     *
     * @param config     渠道配置
     * @param outTradeNo 商户订单号
     * @return 查询结果，包含 trade_status 和 money
     */
    OrderQueryResult queryOrder(ChannelConfig config, String outTradeNo);

    record EpayResult(int code, String msg, String tradeNo, String payUrl, String qrcodeUrl) {}

    record OrderQueryResult(String tradeStatus, String money, String tradeNo) {}
}
