package com.orionkey.repository;

import com.orionkey.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    // 首页商品列表 — 无搜索词
    @Query("SELECT p FROM Product p WHERE p.isDeleted = 0 AND p.isEnabled = true " +
            "AND (:categoryId IS NULL OR p.categoryId = :categoryId)")
    Page<Product> findPublicProducts(@Param("categoryId") UUID categoryId,
                                     Pageable pageable);

    // 首页商品列表 — 带搜索词（keyword 保证非 null）
    @Query("SELECT p FROM Product p WHERE p.isDeleted = 0 AND p.isEnabled = true " +
            "AND (:categoryId IS NULL OR p.categoryId = :categoryId) " +
            "AND LOWER(p.title) LIKE :keywordPattern")
    Page<Product> findPublicProductsByKeyword(@Param("categoryId") UUID categoryId,
                                              @Param("keywordPattern") String keywordPattern,
                                              Pageable pageable);

    // 管理后台商品列表 — 无搜索词
    @Query("SELECT p FROM Product p WHERE p.isDeleted = 0 " +
            "AND (:categoryId IS NULL OR p.categoryId = :categoryId) " +
            "AND (:isEnabled IS NULL OR p.isEnabled = :isEnabled)")
    Page<Product> findAdminProducts(@Param("categoryId") UUID categoryId,
                                    @Param("isEnabled") Boolean isEnabled,
                                    Pageable pageable);

    // 管理后台商品列表 — 带搜索词（keyword 保证非 null）
    @Query("SELECT p FROM Product p WHERE p.isDeleted = 0 " +
            "AND (:categoryId IS NULL OR p.categoryId = :categoryId) " +
            "AND LOWER(p.title) LIKE :keywordPattern " +
            "AND (:isEnabled IS NULL OR p.isEnabled = :isEnabled)")
    Page<Product> findAdminProductsByKeyword(@Param("categoryId") UUID categoryId,
                                             @Param("keywordPattern") String keywordPattern,
                                             @Param("isEnabled") Boolean isEnabled,
                                             Pageable pageable);

    long countByCategoryIdAndIsDeleted(UUID categoryId, int isDeleted);
}
