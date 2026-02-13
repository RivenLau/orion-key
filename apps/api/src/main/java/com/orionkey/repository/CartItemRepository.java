package com.orionkey.repository;

import com.orionkey.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CartItemRepository extends JpaRepository<CartItem, UUID> {

    List<CartItem> findByUserId(UUID userId);

    List<CartItem> findBySessionToken(String sessionToken);

    Optional<CartItem> findByUserIdAndProductIdAndSpecId(UUID userId, UUID productId, UUID specId);

    Optional<CartItem> findBySessionTokenAndProductIdAndSpecId(String sessionToken, UUID productId, UUID specId);

    @Transactional
    void deleteBySessionToken(String sessionToken);
}
