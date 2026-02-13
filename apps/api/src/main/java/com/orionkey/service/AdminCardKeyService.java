package com.orionkey.service;

import com.orionkey.common.PageResult;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface AdminCardKeyService {

    List<?> getStockSummary(UUID productId, UUID specId);

    Map<String, Object> importCardKeys(Map<String, Object> request, UUID importedBy);

    PageResult<?> getImportBatches(UUID productId, int page, int pageSize);

    void invalidateCardKey(UUID id);

    List<?> getCardKeysByOrder(UUID orderId);
}
