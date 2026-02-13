package com.orionkey.controller;

import com.orionkey.service.WebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/payments/webhook")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final WebhookService webhookService;

    @PostMapping("/{channelCode}")
    public ResponseEntity<String> handleWebhook(@PathVariable String channelCode,
                                                 @RequestBody Map<String, Object> payload) {
        String result = webhookService.processWebhook(channelCode, payload);
        return ResponseEntity.ok(result);
    }
}
