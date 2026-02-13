package com.orionkey.service;

import com.orionkey.common.PageResult;

import java.util.Map;
import java.util.UUID;

public interface ProductService {

    PageResult<?> listPublicProducts(UUID categoryId, String keyword, int page, int pageSize);

    Map<String, Object> getProductDetail(UUID id);

    Map<String, Object> getAdminProductDetail(UUID id);

    PageResult<?> listAdminProducts(UUID categoryId, String keyword, Boolean isEnabled, int page, int pageSize);

    Map<String, Object> createProduct(Map<String, Object> request);

    void updateProduct(UUID id, Map<String, Object> request);

    void deleteProduct(UUID id);

    Object listSpecs(UUID productId);

    void createSpec(UUID productId, Map<String, Object> request);

    void updateSpec(UUID productId, UUID specId, Map<String, Object> request);

    void deleteSpec(UUID productId, UUID specId);

    Object listWholesaleRules(UUID productId);

    void setWholesaleRules(UUID productId, Map<String, Object> request);
}
