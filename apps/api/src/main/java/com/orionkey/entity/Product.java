package com.orionkey.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "products")
public class Product extends BaseEntity {

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String detailMd;

    private String coverUrl;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice;

    @Column(length = 10)
    private String currency = "CNY";

    @Column(nullable = false)
    private UUID categoryId;

    @Column(length = 10)
    private String deliveryType = "AUTO";

    private int lowStockThreshold = 10;

    private boolean wholesaleEnabled = false;

    @Column(name = "is_enabled")
    private boolean enabled = true;

    private int initialSales = 0;

    private int sortOrder = 0;

    private int isDeleted = 0;
}
