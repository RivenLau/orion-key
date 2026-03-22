package com.orionkey.repository;

import com.orionkey.entity.ProductSpec;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProductSpecRepository extends JpaRepository<ProductSpec, UUID> {

    List<ProductSpec> findByProductIdAndIsDeletedOrderBySortOrderAsc(UUID productId, int isDeleted);

    boolean existsByProductIdAndNameAndIsDeleted(UUID productId, String name, int isDeleted);
}
