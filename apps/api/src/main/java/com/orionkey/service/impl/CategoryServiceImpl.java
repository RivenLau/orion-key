package com.orionkey.service.impl;

import com.orionkey.constant.ErrorCode;
import com.orionkey.entity.ProductCategory;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.ProductCategoryRepository;
import com.orionkey.repository.ProductRepository;
import com.orionkey.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final ProductCategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    @Override
    public List<?> listCategories() {
        return categoryRepository.findByIsDeletedOrderBySortOrderAsc(0).stream()
                .map(c -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", c.getId());
                    map.put("name", c.getName());
                    map.put("sort_order", c.getSortOrder());
                    return map;
                }).toList();
    }

    @Override
    @Transactional
    public void createCategory(Map<String, Object> req) {
        String name = (String) req.get("name");
        if (categoryRepository.existsByNameAndIsDeleted(name, 0)) {
            throw new BusinessException(ErrorCode.CATEGORY_NAME_EXISTS, "分类名称已存在");
        }
        ProductCategory category = new ProductCategory();
        category.setName(name);
        if (req.containsKey("sort_order")) category.setSortOrder(((Number) req.get("sort_order")).intValue());
        categoryRepository.save(category);
    }

    @Override
    @Transactional
    public void updateCategory(UUID id, Map<String, Object> req) {
        ProductCategory category = categoryRepository.findById(id)
                .filter(c -> c.getIsDeleted() == 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "分类不存在"));
        if (req.containsKey("name")) {
            String name = (String) req.get("name");
            if (categoryRepository.existsByNameAndIdNotAndIsDeleted(name, id, 0)) {
                throw new BusinessException(ErrorCode.CATEGORY_NAME_EXISTS, "分类名称已存在");
            }
            category.setName(name);
        }
        if (req.containsKey("sort_order")) category.setSortOrder(((Number) req.get("sort_order")).intValue());
        categoryRepository.save(category);
    }

    @Override
    @Transactional
    public void deleteCategory(UUID id) {
        ProductCategory category = categoryRepository.findById(id)
                .filter(c -> c.getIsDeleted() == 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "分类不存在"));
        if (productRepository.countByCategoryIdAndIsDeleted(id, 0) > 0) {
            throw new BusinessException(ErrorCode.CATEGORY_HAS_PRODUCTS, "该分类下存在商品，无法删除");
        }
        category.setIsDeleted(1);
        categoryRepository.save(category);
    }
}
