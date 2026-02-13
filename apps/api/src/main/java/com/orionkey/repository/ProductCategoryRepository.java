package com.orionkey.repository;

import com.orionkey.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {

    List<ProductCategory> findByIsDeletedOrderBySortOrderAsc(int isDeleted);

    boolean existsByNameAndIsDeleted(String name, int isDeleted);

    boolean existsByNameAndIdNotAndIsDeleted(String name, UUID id, int isDeleted);
}
