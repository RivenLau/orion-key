package com.orionkey.service;

import java.util.Map;

public interface WebhookService {

    String processWebhook(String channelCode, Map<String, Object> payload);
}
