package com.orionkey.service;

import com.orionkey.common.PageResult;

import java.util.UUID;

public interface AdminOrderService {

    PageResult<?> listOrders(String status, String orderType, String paymentMethod,
                             Boolean isRiskFlagged, String keyword, int page, int pageSize);

    Object getOrderDetail(UUID id);

    void markPaid(UUID id);
}
