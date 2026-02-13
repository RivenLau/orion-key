package com.orionkey.service.impl;

import com.orionkey.constant.ErrorCode;
import com.orionkey.entity.PaymentChannel;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.PaymentChannelRepository;
import com.orionkey.service.AdminPaymentChannelService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminPaymentChannelServiceImpl implements AdminPaymentChannelService {

    private final PaymentChannelRepository paymentChannelRepository;

    @Override
    public List<?> listChannels() {
        return paymentChannelRepository.findByIsDeletedOrderBySortOrderAsc(0).stream()
                .map(this::toMap).toList();
    }

    @Override
    @Transactional
    public void createChannel(Map<String, Object> req) {
        PaymentChannel channel = new PaymentChannel();
        channel.setChannelCode((String) req.get("channel_code"));
        channel.setChannelName((String) req.get("channel_name"));
        Object configData = req.get("config_data");
        channel.setConfigData(configData != null ? configData.toString() : null);
        if (req.containsKey("is_enabled")) channel.setEnabled((boolean) req.get("is_enabled"));
        if (req.containsKey("sort_order")) channel.setSortOrder(((Number) req.get("sort_order")).intValue());
        paymentChannelRepository.save(channel);
    }

    @Override
    @Transactional
    public void updateChannel(UUID id, Map<String, Object> req) {
        PaymentChannel channel = paymentChannelRepository.findById(id)
                .filter(c -> c.getIsDeleted() == 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "支付渠道不存在"));
        if (req.containsKey("channel_name")) channel.setChannelName((String) req.get("channel_name"));
        if (req.containsKey("config_data")) {
            Object configData = req.get("config_data");
            channel.setConfigData(configData != null ? configData.toString() : null);
        }
        if (req.containsKey("is_enabled")) channel.setEnabled((boolean) req.get("is_enabled"));
        if (req.containsKey("sort_order")) channel.setSortOrder(((Number) req.get("sort_order")).intValue());
        paymentChannelRepository.save(channel);
    }

    @Override
    @Transactional
    public void deleteChannel(UUID id) {
        PaymentChannel channel = paymentChannelRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "支付渠道不存在"));
        channel.setIsDeleted(1);
        paymentChannelRepository.save(channel);
    }

    private Map<String, Object> toMap(PaymentChannel c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("channel_code", c.getChannelCode());
        map.put("channel_name", c.getChannelName());
        map.put("is_enabled", c.isEnabled());
        map.put("sort_order", c.getSortOrder());
        map.put("created_at", c.getCreatedAt());
        return map;
    }
}
