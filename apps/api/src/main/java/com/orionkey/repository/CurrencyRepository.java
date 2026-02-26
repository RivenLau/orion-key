package com.orionkey.repository;

import com.orionkey.entity.Currency;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CurrencyRepository extends JpaRepository<Currency, UUID> {

    List<Currency> findByEnabledOrderBySortOrderAsc(boolean enabled);
}
