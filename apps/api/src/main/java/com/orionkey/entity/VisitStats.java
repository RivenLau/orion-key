package com.orionkey.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "visit_stats")
public class VisitStats extends BaseEntity {

    @Column(unique = true, nullable = false)
    private LocalDate visitDate;

    private int pv = 0;

    private int uv = 0;
}
