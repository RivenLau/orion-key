package com.orionkey.config;

import com.orionkey.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 应用启动后执行的一次性数据迁移。
 * 将已有规格但 spec_enabled=false 的商品自动设为 true，确保向后兼容。
 * 幂等安全：后续启动无匹配行时 0 行更新，无副作用。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataMigrationRunner implements ApplicationRunner {

    private final ProductRepository productRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int updated = productRepository.migrateSpecEnabled();
        if (updated > 0) {
            log.info("Migration: set spec_enabled=true for {} products with existing specs", updated);
        }
    }
}
