package com.orionkey.service;

import com.orionkey.common.PageResult;

import java.util.Map;

public interface RiskConfigService {

    Map<String, Object> getRiskConfig();

    void updateRiskConfig(Map<String, Object> request);

    PageResult<?> getFlaggedOrders(int page, int pageSize);
}
