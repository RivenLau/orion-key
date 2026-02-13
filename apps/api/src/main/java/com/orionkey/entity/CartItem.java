package com.orionkey.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "cart_items")
public class CartItem extends BaseEntity {

    private UUID userId;

    private String sessionToken;

    @Column(nullable = false)
    private UUID productId;

    private UUID specId;

    @Column(nullable = false)
    private int quantity;
}
