package com.orionkey.controller;

import com.orionkey.service.WebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/payments/webhook")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final WebhookService webhookService;

    /**
     * 易支付 GET callback — returns plain text "SUCCESS"
     */
    @GetMapping(value = "/epay", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> handleEpayCallback(@RequestParam Map<String, String> params) {
        log.info("Epay callback received: {}", params);
        String result = webhookService.processEpayCallback(params);
        return ResponseEntity.ok(result);
    }

    /**
     * BEpusdt USDT 支付回调 — POST JSON，返回 "ok" 表示成功
     */
    @PostMapping(value = "/usdt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> handleBepusdtCallback(@RequestBody Map<String, Object> params) {
        log.info("BEpusdt callback received: {}", params);
        String result = webhookService.processBepusdtCallback(params);
        return ResponseEntity.ok(result);
    }
}
