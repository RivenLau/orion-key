package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.constant.ErrorCode;
import com.orionkey.constant.OrderStatus;
import com.orionkey.context.RequestContext;
import com.orionkey.entity.Order;
import com.orionkey.entity.UnmatchedTransaction;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.UnmatchedTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/admin/txid-reviews")
@RequiredArgsConstructor
public class AdminTxidReviewController {

    private final UnmatchedTransactionRepository unmatchedTransactionRepository;
    private final OrderRepository orderRepository;

    @GetMapping
    public ApiResponse<?> listTxidReviews(
            @RequestParam(defaultValue = "PENDING_REVIEW") String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(value = "page_size", defaultValue = "20") int pageSize) {

        Page<UnmatchedTransaction> result = unmatchedTransactionRepository
                .findByStatusOrderByCreatedAtDesc(status, PageRequest.of(page - 1, pageSize));

        Map<String, Object> response = new LinkedHashMap<>();
        List<Map<String, Object>> items = new ArrayList<>();
        for (UnmatchedTransaction ut : result.getContent()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", ut.getId());
            item.put("order_id", ut.getOrderId());
            item.put("txid", ut.getTxid());
            item.put("chain", ut.getChain());
            item.put("on_chain_from", ut.getOnChainFrom());
            item.put("on_chain_to", ut.getOnChainTo());
            item.put("on_chain_amount", ut.getOnChainAmount());
            item.put("expected_amount", ut.getExpectedAmount());
            item.put("amount_diff", ut.getAmountDiff());
            item.put("source", ut.getSource());
            item.put("status", ut.getStatus());
            item.put("verify_reason", ut.getVerifyReason());
            item.put("submitted_at", ut.getSubmittedAt());
            item.put("reviewed_at", ut.getReviewedAt());
            items.add(item);
        }
        response.put("list", items);
        response.put("total", result.getTotalElements());
        response.put("page", page);
        response.put("page_size", pageSize);

        return ApiResponse.success(response);
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<Void> approveTxidReview(@PathVariable UUID id) {
        UnmatchedTransaction ut = unmatchedTransactionRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "审核记录不存在"));

        if (!"PENDING_REVIEW".equals(ut.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该记录状态不允许审核");
        }

        // 更新审核记录
        ut.setStatus("APPROVED");
        ut.setVerifyReason("人工审核通过");
        ut.setReviewerId(RequestContext.getUserId());
        ut.setReviewedAt(LocalDateTime.now());
        unmatchedTransactionRepository.save(ut);

        // 更新关联订单状态为 PAID
        if (ut.getOrderId() != null) {
            Order order = orderRepository.findById(ut.getOrderId()).orElse(null);
            if (order != null && (order.getStatus() == OrderStatus.PENDING || order.getStatus() == OrderStatus.EXPIRED)) {
                order.setStatus(OrderStatus.PAID);
                order.setPaidAt(LocalDateTime.now());
                order.setUsdtTxId(ut.getTxid());
                orderRepository.save(order);
                log.info("TXID review approved: order {} marked as PAID", ut.getOrderId());
            }
        }

        return ApiResponse.success();
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<Void> rejectTxidReview(@PathVariable UUID id,
                                               @RequestBody Map<String, String> request) {
        UnmatchedTransaction ut = unmatchedTransactionRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "审核记录不存在"));

        if (!"PENDING_REVIEW".equals(ut.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该记录状态不允许审核");
        }

        String reason = request.getOrDefault("reason", "人工审核拒绝");
        ut.setStatus("REJECTED");
        ut.setVerifyReason(reason);
        ut.setReviewerId(RequestContext.getUserId());
        ut.setReviewedAt(LocalDateTime.now());
        unmatchedTransactionRepository.save(ut);

        log.info("TXID review rejected: id={}, reason={}", id, reason);
        return ApiResponse.success();
    }
}
