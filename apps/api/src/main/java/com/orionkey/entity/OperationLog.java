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
@Table(name = "operation_logs")
public class OperationLog extends BaseEntity {

    @Column(nullable = false)
    private UUID userId;

    private String username;

    @Column(nullable = false)
    private String action;

    private String targetType;

    private String targetId;

    @Column(columnDefinition = "TEXT")
    private String detail;

    private String ipAddress;
}
