package com.orionkey.service.impl;

import com.orionkey.common.PageResult;
import com.orionkey.entity.OperationLog;
import com.orionkey.repository.OperationLogRepository;
import com.orionkey.service.OperationLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OperationLogServiceImpl implements OperationLogService {

    private final OperationLogRepository operationLogRepository;

    @Override
    public PageResult<?> listLogs(UUID userId, String action, String targetType,
                                   String startDate, String endDate, int page, int pageSize) {
        var pageable = PageRequest.of(page - 1, pageSize);
        LocalDateTime start = startDate != null ? LocalDate.parse(startDate).atStartOfDay() : null;
        LocalDateTime end = endDate != null ? LocalDate.parse(endDate).atTime(LocalTime.MAX) : null;

        Page<OperationLog> logPage = operationLogRepository.findByFilters(userId, action, targetType, start, end, pageable);
        return PageResult.of(logPage, logPage.getContent());
    }

    @Override
    public void log(UUID userId, String username, String action, String targetType,
                    String targetId, String detail, String ip) {
        OperationLog log = new OperationLog();
        log.setUserId(userId);
        log.setUsername(username);
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDetail(detail);
        log.setIpAddress(ip);
        operationLogRepository.save(log);
    }
}
