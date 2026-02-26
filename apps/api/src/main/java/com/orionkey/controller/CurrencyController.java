package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.entity.Currency;
import com.orionkey.repository.CurrencyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/currencies")
@RequiredArgsConstructor
public class CurrencyController {

    private final CurrencyRepository currencyRepository;

    @GetMapping
    public ApiResponse<?> listEnabledCurrencies() {
        List<Map<String, Object>> currencies = currencyRepository
                .findByEnabledOrderBySortOrderAsc(true)
                .stream()
                .map(this::toMap)
                .toList();
        return ApiResponse.success(currencies);
    }

    private Map<String, Object> toMap(Currency c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("code", c.getCode());
        map.put("name", c.getName());
        map.put("symbol", c.getSymbol());
        return map;
    }
}
