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
@Table(name = "webhook_events")
public class WebhookEvent extends BaseEntity {

    @Column(unique = true, nullable = false)
    private String eventId;

    @Column(nullable = false)
    private String channelCode;

    @Column(nullable = false)
    private UUID orderId;

    @Column(columnDefinition = "TEXT")
    private String payload;

    private String processResult;

    private int retryCount = 0;
}
