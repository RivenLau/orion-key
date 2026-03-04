package com.orionkey.repository;

import com.orionkey.entity.UnmatchedTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UnmatchedTransactionRepository extends JpaRepository<UnmatchedTransaction, UUID> {

    Optional<UnmatchedTransaction> findByTxid(String txid);

    Page<UnmatchedTransaction> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    List<UnmatchedTransaction> findByOrderId(UUID orderId);
}
