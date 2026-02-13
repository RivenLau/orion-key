package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.service.OperationLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/admin/operation-logs")
@RequiredArgsConstructor
public class AdminOperationLogController {

    private final OperationLogService operationLogService;

    @GetMapping
    public ApiResponse<?> listLogs(
            @RequestParam(value = "user_id", required = false) UUID userId,
            @RequestParam(required = false) String action,
            @RequestParam(value = "target_type", required = false) String targetType,
            @RequestParam(value = "start_date", required = false) String startDate,
            @RequestParam(value = "end_date", required = false) String endDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(value = "page_size", defaultValue = "20") int pageSize) {
        return ApiResponse.success(operationLogService.listLogs(userId, action, targetType, startDate, endDate, page, pageSize));
    }
}
