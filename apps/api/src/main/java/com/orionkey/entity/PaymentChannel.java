package com.orionkey.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "payment_channels")
public class PaymentChannel extends BaseEntity {

    @Column(nullable = false)
    private String channelCode;

    @Column(nullable = false)
    private String channelName;

    @Column(columnDefinition = "TEXT")
    private String configData;

    @Column(name = "is_enabled")
    private boolean isEnabled = true;

    private int sortOrder = 0;

    private int isDeleted = 0;
}
