package com.orionkey.service.impl;

import com.orionkey.entity.VisitStats;
import com.orionkey.repository.VisitStatsRepository;
import com.orionkey.service.VisitService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class VisitServiceImpl implements VisitService {

    private final VisitStatsRepository visitStatsRepository;

    /** 当天已记录的 IP 集合（用于 UV 去重） */
    private volatile LocalDate currentDate = LocalDate.now();
    private final Set<String> todayIps = Collections.newSetFromMap(new ConcurrentHashMap<>());

    @Override
    @Transactional
    public void track(String ip) {
        LocalDate today = LocalDate.now();

        // 日切：跨天时清空 IP 集合
        if (!today.equals(currentDate)) {
            synchronized (this) {
                if (!today.equals(currentDate)) {
                    todayIps.clear();
                    currentDate = today;
                }
            }
        }

        boolean isNewIp = todayIps.add(ip);

        VisitStats stats = visitStatsRepository.findByVisitDate(today)
                .orElseGet(() -> {
                    VisitStats s = new VisitStats();
                    s.setVisitDate(today);
                    s.setPv(0);
                    s.setUv(0);
                    return s;
                });

        stats.setPv(stats.getPv() + 1);
        if (isNewIp) {
            stats.setUv(stats.getUv() + 1);
        }

        visitStatsRepository.save(stats);
    }
}
