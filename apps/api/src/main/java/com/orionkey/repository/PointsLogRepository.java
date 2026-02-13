package com.orionkey.repository;

import com.orionkey.entity.PointsLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PointsLogRepository extends JpaRepository<PointsLog, UUID> {

    Page<PointsLog> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}
