package com.orionkey.repository;

import com.orionkey.entity.SiteConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SiteConfigRepository extends JpaRepository<SiteConfig, UUID> {

    Optional<SiteConfig> findByConfigKey(String configKey);

    List<SiteConfig> findByConfigGroup(String configGroup);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SiteConfig c set c.configValue = :value where c.configKey = 'homepage_ads' and c.configValue = :expected")
    int updateHomeAdsIfUnchanged(@Param("expected") String expected, @Param("value") String value);
}
