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

    @Query(value = "SELECT * FROM operation_logs o WHERE " +
            "(CAST(:userId AS uuid) IS NULL OR o.user_id = CAST(:userId AS uuid)) " +
            "AND (CAST(:action AS text) IS NULL OR o.action LIKE CAST(:action AS text) || '%') " +
            "AND (CAST(:targetType AS text) IS NULL OR o.target_type = CAST(:targetType AS text)) " +
            "AND (CAST(:startDate AS timestamp) IS NULL OR o.created_at >= CAST(:startDate AS timestamp)) " +
            "AND (CAST(:endDate AS timestamp) IS NULL OR o.created_at <= CAST(:endDate AS timestamp)) " +
            "ORDER BY o.created_at DESC",
            countQuery = "SELECT COUNT(*) FROM operation_logs o WHERE " +
            "(CAST(:userId AS uuid) IS NULL OR o.user_id = CAST(:userId AS uuid)) " +
            "AND (CAST(:action AS text) IS NULL OR o.action LIKE CAST(:action AS text) || '%') " +
            "AND (CAST(:targetType AS text) IS NULL OR o.target_type = CAST(:targetType AS text)) " +
            "AND (CAST(:startDate AS timestamp) IS NULL OR o.created_at >= CAST(:startDate AS timestamp)) " +
            "AND (CAST(:endDate AS timestamp) IS NULL OR o.created_at <= CAST(:endDate AS timestamp))",
            nativeQuery = true)
    Page<OperationLog> findByFilters(@Param("userId") UUID userId,
                                     @Param("action") String action,
                                     @Param("targetType") String targetType,
                                     @Param("startDate") LocalDateTime startDate,
                                     @Param("endDate") LocalDateTime endDate,
                                     Pageable pageable);
}
