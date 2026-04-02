package com.orionkey.repository;

import com.orionkey.constant.CardKeyStatus;
import com.orionkey.entity.CardKey;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CardKeyRepository extends JpaRepository<CardKey, UUID> {

    @Query(value = "SELECT * FROM card_keys WHERE product_id = :productId " +
            "AND ((:specId IS NULL AND spec_id IS NULL) OR spec_id = CAST(:specId AS uuid)) " +
            "AND status = 'AVAILABLE' ORDER BY created_at ASC LIMIT :count " +
            "FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<CardKey> findAndLockAvailable(@Param("productId") UUID productId,
                                       @Param("specId") UUID specId,
                                       @Param("count") int count);

    long countByProductIdAndStatus(UUID productId, CardKeyStatus status);

    long countByProductIdAndSpecIdAndStatus(UUID productId, UUID specId, CardKeyStatus status);

    long countByProductIdAndSpecIdIsNullAndStatus(UUID productId, CardKeyStatus status);

    List<CardKey> findByOrderId(UUID orderId);

    boolean existsByContentAndProductId(String content, UUID productId);

    @Query("SELECT CASE WHEN COUNT(ck) > 0 THEN true ELSE false END FROM CardKey ck " +
            "WHERE ck.content = :content AND ck.productId = :productId " +
            "AND ((:specId IS NULL AND ck.specId IS NULL) OR ck.specId = :specId)")
    boolean existsByContentAndProductIdAndSpecId(@Param("content") String content,
                                                 @Param("productId") UUID productId,
                                                 @Param("specId") UUID specId);

    @Query("SELECT COUNT(ck) FROM CardKey ck WHERE ck.productId = :productId " +
            "AND ((:specId IS NULL AND ck.specId IS NULL) OR ck.specId = :specId) " +
            "AND ck.status <> :excludeStatus")
    long countByProductIdAndSpecIdExcludingStatus(@Param("productId") UUID productId,
                                                   @Param("specId") UUID specId,
                                                   @Param("excludeStatus") CardKeyStatus excludeStatus);

    @Query("SELECT ck FROM CardKey ck WHERE ck.productId = :productId " +
            "AND ((:specId IS NULL AND ck.specId IS NULL) OR ck.specId = :specId) " +
            "ORDER BY ck.createdAt DESC")
    Page<CardKey> findByProductIdAndOptionalSpecId(@Param("productId") UUID productId,
                                                    @Param("specId") UUID specId,
                                                    Pageable pageable);

    @Query("SELECT ck.status, COUNT(ck) FROM CardKey ck " +
            "WHERE ck.productId = :productId AND ((:specId IS NULL AND ck.specId IS NULL) OR ck.specId = :specId) " +
            "GROUP BY ck.status")
    List<Object[]> countByProductIdAndSpecIdGroupByStatus(@Param("productId") UUID productId,
                                                          @Param("specId") UUID specId);

    @Modifying
    @Query("UPDATE CardKey ck SET ck.status = :newStatus " +
            "WHERE ck.productId = :productId " +
            "AND ((:specId IS NULL AND ck.specId IS NULL) OR ck.specId = :specId) " +
            "AND ck.status = :oldStatus")
    int updateStatusByProductIdAndSpecId(@Param("productId") UUID productId,
                                         @Param("specId") UUID specId,
                                         @Param("oldStatus") CardKeyStatus oldStatus,
                                         @Param("newStatus") CardKeyStatus newStatus);
}
