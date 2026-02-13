package com.orionkey.repository;

import com.orionkey.entity.SiteConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SiteConfigRepository extends JpaRepository<SiteConfig, UUID> {

    Optional<SiteConfig> findByConfigKey(String configKey);

    List<SiteConfig> findByConfigGroup(String configGroup);
}
