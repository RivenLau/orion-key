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

    /**
     * 支付提供商类型：epay / native_alipay / native_wxpay / usdt
     * 同一 channelCode 只能有一个已启用的 providerType
     */
    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'epay'")
    private String providerType = "epay";

    @Column(columnDefinition = "TEXT")
    private String configData;

    @Column(name = "is_enabled")
    private boolean enabled = true;

    private int sortOrder = 0;

    private int isDeleted = 0;
}
