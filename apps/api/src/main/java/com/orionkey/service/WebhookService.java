package com.orionkey.service;

import java.util.Map;

public interface WebhookService {

    String processWebhook(String channelCode, Map<String, Object> payload);

    /**
     * 处理易支付 GET 回调
     */
    String processEpayCallback(Map<String, String> params);

    /**
     * 处理 BEpusdt USDT 支付回调（JSON body，含非 String 类型字段如 amount/status）
     */
    String processBepusdtCallback(Map<String, Object> params);
}
