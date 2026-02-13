package com.orionkey.repository;

import com.orionkey.entity.CardImportBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CardImportBatchRepository extends JpaRepository<CardImportBatch, UUID> {

    Page<CardImportBatch> findByProductIdOrderByCreatedAtDesc(UUID productId, Pageable pageable);

    Page<CardImportBatch> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
