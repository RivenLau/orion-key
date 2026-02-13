package com.orionkey.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface AdminPaymentChannelService {

    List<?> listChannels();

    void createChannel(Map<String, Object> request);

    void updateChannel(UUID id, Map<String, Object> request);

    void deleteChannel(UUID id);
}
