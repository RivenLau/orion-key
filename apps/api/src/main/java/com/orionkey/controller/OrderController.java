package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.constant.ErrorCode;
import com.orionkey.constant.OrderStatus;
import com.orionkey.context.RequestContext;
import com.orionkey.entity.Order;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.UnmatchedTransactionRepository;
import com.orionkey.service.DeliverService;
import com.orionkey.service.OrderService;
import com.orionkey.service.TxidVerifyService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final DeliverService deliverService;
    private final OrderRepository orderRepository;
    private final UnmatchedTransactionRepository unmatchedTransactionRepository;
    private final TxidVerifyService txidVerifyService;
    private final com.orionkey.service.PaymentService paymentService;

    @PostMapping
    public ApiResponse<?> createOrder(@RequestBody Map<String, Object> request,
                                      @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                      HttpServletRequest httpRequest) {
        return ApiResponse.success(orderService.createDirectOrder(
                request, RequestContext.getUserId(), httpRequest.getRemoteAddr(), sessionToken));
    }

    @PostMapping("/from-cart")
    public ApiResponse<?> createCartOrder(@RequestBody Map<String, Object> request,
                                          @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                          HttpServletRequest httpRequest) {
        return ApiResponse.success(orderService.createCartOrder(
                request, RequestContext.getUserId(), httpRequest.getRemoteAddr(), sessionToken));
    }

    @GetMapping("/{id}/status")
    public ApiResponse<?> getOrderStatus(@PathVariable UUID id) {
        return ApiResponse.success(orderService.getOrderStatus(id));
    }

    @PostMapping("/{id}/refresh")
    public ApiResponse<?> refreshOrderStatus(@PathVariable UUID id) {
        return ApiResponse.success(orderService.refreshOrderStatus(id));
    }

    @PostMapping("/query")
    public ApiResponse<?> queryOrders(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(deliverService.queryOrders(request));
    }

    @PostMapping("/deliver")
    public ApiResponse<?> deliverOrders(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(deliverService.deliverOrders(request));
    }

    @GetMapping("/{id}/export")
    public void exportCardKeys(@PathVariable UUID id, HttpServletResponse response) throws Exception {
        String content = deliverService.exportCardKeys(id);
        response.setContentType("text/plain; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=card-keys-" + id + ".txt");
        response.getWriter().write(content);
    }

    /**
     * 重新发起支付（移动端支付取消/失败后重试）
     */
    @PostMapping("/{id}/repay")
    public ApiResponse<?> repayOrder(@PathVariable UUID id,
                                     @RequestBody(required = false) Map<String, String> body) {
        String device = body != null ? body.get("device") : null;
        return ApiResponse.success(paymentService.repay(id, device));
    }

    /**
     * 用户提交 TXID 进行自动链上验证（USDT 补单）
     */
    @PostMapping("/{id}/txid-verify")
    public ApiResponse<?> submitTxidForVerification(@PathVariable UUID id,
                                                     @RequestBody Map<String, String> request) {
        String txid = request.get("txid");
        if (txid == null || txid.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请提供交易哈希（TXID）");
        }
        txid = txid.trim();

        // 1. 校验订单存在
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND, "订单不存在"));

        // 2. 校验订单状态为 PENDING 或 EXPIRED
        if (order.getStatus() != OrderStatus.PENDING && order.getStatus() != OrderStatus.EXPIRED) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该订单状态不允许提交 TXID 验证");
        }

        // 3. 校验订单支付方式为 USDT
        if (order.getPaymentMethod() == null || !order.getPaymentMethod().startsWith("usdt_")) {
            throw new BusinessException(ErrorCode.ORDER_NOT_USDT, "该订单非 USDT 支付方式");
        }

        // 4. 校验 TXID 格式
        validateTxidFormat(txid, order.getUsdtChain());

        // 5. 校验 TXID 未被其他订单使用（同时检查 unmatched_transactions 表和 orders.usdt_tx_id 字段）
        if (unmatchedTransactionRepository.findByTxid(txid).isPresent()) {
            throw new BusinessException(ErrorCode.TXID_ALREADY_USED, "该交易哈希已被提交过");
        }
        if (orderRepository.findByUsdtTxId(txid).isPresent()) {
            throw new BusinessException(ErrorCode.TXID_ALREADY_USED, "该交易哈希已关联到其他订单");
        }

        // 6. 调用自动审核
        TxidVerifyService.VerifyDetail detail = txidVerifyService.verifyAndProcess(order, txid);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("result", detail.result().name());
        data.put("reason", detail.reason());
        return ApiResponse.success(data);
    }

    private void validateTxidFormat(String txid, String chain) {
        if (chain != null && chain.contains("trc20")) {
            // TRC20: 64 位 hex
            if (!txid.matches("^[a-fA-F0-9]{64}$")) {
                throw new BusinessException(ErrorCode.TXID_INVALID_FORMAT, "TXID 格式不正确，TRC-20 交易哈希应为 64 位十六进制字符");
            }
        } else if (chain != null && chain.contains("bep20")) {
            // BEP20: 0x 前缀 + 64 位 hex
            if (!txid.matches("^0x[a-fA-F0-9]{64}$")) {
                throw new BusinessException(ErrorCode.TXID_INVALID_FORMAT, "TXID 格式不正确，BEP-20 交易哈希应为 0x 开头的 66 位十六进制字符");
            }
        }
    }
}
