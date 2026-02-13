package com.orionkey.repository;

import com.orionkey.entity.OperationLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface OperationLogRepository extends JpaRepository<OperationLog, UUID> {

    @Query("SELECT o FROM OperationLog o WHERE " +
            "(:userId IS NULL OR o.userId = :userId) " +
            "AND (:action IS NULL OR o.action = :action) " +
            "AND (:targetType IS NULL OR o.targetType = :targetType) " +
            "AND (:startDate IS NULL OR o.createdAt >= :startDate) " +
            "AND (:endDate IS NULL OR o.createdAt <= :endDate) " +
            "ORDER BY o.createdAt DESC")
    Page<OperationLog> findByFilters(@Param("userId") UUID userId,
                                     @Param("action") String action,
                                     @Param("targetType") String targetType,
                                     @Param("startDate") LocalDateTime startDate,
                                     @Param("endDate") LocalDateTime endDate,
                                     Pageable pageable);
}
