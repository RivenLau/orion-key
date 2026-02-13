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
@Table(name = "points_logs")
public class PointsLog extends BaseEntity {

    @Column(nullable = false)
    private UUID userId;

    private int changeAmount;

    private int balanceAfter;

    @Column(nullable = false)
    private String reason;

    private UUID orderId;
}
