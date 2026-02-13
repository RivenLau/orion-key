package com.orionkey.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface CategoryService {

    List<?> listCategories();

    void createCategory(Map<String, Object> request);

    void updateCategory(UUID id, Map<String, Object> request);

    void deleteCategory(UUID id);
}
