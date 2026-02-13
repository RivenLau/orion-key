package com.orionkey.repository;

import com.orionkey.entity.WholesaleRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface WholesaleRuleRepository extends JpaRepository<WholesaleRule, UUID> {

    List<WholesaleRule> findByProductIdAndSpecIdOrderByMinQuantityAsc(UUID productId, UUID specId);

    List<WholesaleRule> findByProductIdAndSpecIdIsNullOrderByMinQuantityAsc(UUID productId);

    List<WholesaleRule> findByProductIdOrderByMinQuantityAsc(UUID productId);

    @Transactional
    void deleteByProductIdAndSpecId(UUID productId, UUID specId);

    @Transactional
    void deleteByProductIdAndSpecIdIsNull(UUID productId);
}
