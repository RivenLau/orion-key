-- ============================================================
-- Orion Key 初始化数据
-- 首次部署时手动执行一次: psql -U <user> -d <db> -f data.sql
-- 所有 INSERT 均带 WHERE NOT EXISTS，可安全重复执行
-- ============================================================

-- ────────────────────────────────────────
-- 1. 管理员账户 (密码: admin123，请首次登录后立即修改)
--    默认使用 BCrypt 哈希。若 application.yml 设置了 security.password-plain: true，
--    则需将下方 password_hash 改为明文 'admin123'
-- ────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, role, points, is_deleted, failed_login_attempts, lock_until, created_at, updated_at)
SELECT gen_random_uuid(), 'admin', 'admin@orionkey.com',
       '123456#',
       'ADMIN', 0, 0, 0, NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- ────────────────────────────────────────
-- 2. 站点配置 (config_group = 'site')
-- ────────────────────────────────────────

-- 站点名称，显示在页面标题和 Header
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'site_name', 'Orion Key', 'site', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'site_name');

-- 站点标语，显示在首页 Hero 区域
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'site_slogan', 'Instant Keys, Anytime', 'site', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'site_slogan');

-- 站点描述，显示在首页副标题 / SEO
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'site_description', 'Automated delivery, available 24/7.', 'site', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'site_description');

-- 页脚（留空则不显示）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'footer_text', '由开源 Orion Key 提供服务', 'site', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'footer_text');

INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'github_url', 'https://github.com/RivenLau/orion-key', 'site', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'github_url');

-- 积分功能总开关 (true/false)
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'points_enabled', 'false', 'site', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'points_enabled');

-- 积分倍率：每消费 1 元获得的积分数
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'points_rate', '1', 'site', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'points_rate');

-- 维护模式开关，开启后非管理员请求返回 503 (true/false)
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'maintenance_enabled', 'false', 'site', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'maintenance_enabled');

-- 全站公告开关 (true/false)
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'announcement_enabled', 'false', 'site', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'announcement_enabled');

-- 弹窗通知开关 (true/false)
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'popup_enabled', 'false', 'site', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'popup_enabled');

-- ────────────────────────────────────────
-- 3. 风控配置 (config_group = 'risk')
-- ────────────────────────────────────────

-- 单 IP 每秒最大请求数（令牌桶容量）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'rate_limit_per_second', '25', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'rate_limit_per_second');

-- 单账号连续登录失败上限（超过后需等待冷却）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'login_attempt_limit', '10', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'login_attempt_limit');

-- 每用户单次最大购买数量
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'max_purchase_per_user', '50', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'max_purchase_per_user');

-- 单 IP 最大未支付订单数（防刷单，共享 IP 场景适当放宽）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'max_pending_orders_per_ip', '5', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'max_pending_orders_per_ip');

-- 单用户最大未支付订单数
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'max_pending_orders_per_user', '5', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'max_pending_orders_per_user');

-- 未支付订单自动过期时间（分钟）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'order_expire_minutes', '15', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'order_expire_minutes');

-- Turnstile 人机验证开关（默认关闭，需后台手动启用）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'turnstile_enabled', 'false', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'turnstile_enabled');

-- 设备指纹限流开关（默认关闭，需后台手动启用）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'device_rate_limit_enabled', 'false', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'device_rate_limit_enabled');

-- 设备指纹限流：下单频率上限（次/小时/设备）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'device_order_limit_per_hour', '15', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'device_order_limit_per_hour');

-- 设备指纹限流：TXID 提交上限（次/小时/设备）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'device_txid_limit_per_hour', '5', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'device_txid_limit_per_hour');

-- TXID 提交上限（次/订单）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'txid_submit_limit_per_order', '3', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'txid_submit_limit_per_order');

-- 设备指纹限流：查询频率上限（次/小时/设备）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'device_query_limit_per_hour', '50', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'device_query_limit_per_hour');

-- 设备指纹限流：登录频率上限（次/小时/设备）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'device_login_limit_per_hour', '10', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'device_login_limit_per_hour');

-- 设备指纹限流：注册频率上限（次/小时/设备）
INSERT INTO site_configs (id, config_key, config_value, config_group, created_at, updated_at)
SELECT gen_random_uuid(), 'device_register_limit_per_hour', '10', 'risk', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_configs WHERE config_key = 'device_register_limit_per_hour');


-- ────────────────────────────────────────
-- 4. 货币类型
-- ────────────────────────────────────────
INSERT INTO currencies (id, code, name, symbol, is_enabled, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), 'CNY', '人民币', '¥', true, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'CNY');

INSERT INTO currencies (id, code, name, symbol, is_enabled, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), 'USD', '美元', '$', true, 2, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'USD');

INSERT INTO currencies (id, code, name, symbol, is_enabled, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), 'USDT', 'USDT (TRC-20)', '₮', true, 3, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'USDT');

INSERT INTO currencies (id, code, name, symbol, is_enabled, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), 'EUR', '欧元', '€', true, 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'EUR');

INSERT INTO currencies (id, code, name, symbol, is_enabled, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), 'GBP', '英镑', '£', true, 5, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'GBP');

-- ────────────────────────────────────────
-- 5. 测试数据：商品分类 + 商品 + 卡密（开发/演示用，生产可删除此段）
-- ────────────────────────────────────────

-- 分类：游戏充值
INSERT INTO product_categories (id, name, sort_order, is_deleted, created_at, updated_at)
SELECT 'a0000000-0000-0000-0000-000000000001'::uuid, '游戏充值', 1, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM product_categories WHERE name = '游戏充值');

-- 分类：软件激活
INSERT INTO product_categories (id, name, sort_order, is_deleted, created_at, updated_at)
SELECT 'a0000000-0000-0000-0000-000000000002'::uuid, '软件激活', 2, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM product_categories WHERE name = '软件激活');

-- 分类：会员订阅
INSERT INTO product_categories (id, name, sort_order, is_deleted, created_at, updated_at)
SELECT 'a0000000-0000-0000-0000-000000000003'::uuid, '会员订阅', 3, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM product_categories WHERE name = '会员订阅');

-- 商品1：Steam 50元充值卡（游戏充值分类）
INSERT INTO products (id, title, description, base_price, category_id, low_stock_threshold, wholesale_enabled, is_enabled, sort_order, is_deleted, created_at, updated_at)
SELECT 'b0000000-0000-0000-0000-000000000001'::uuid, 'Steam 50元充值卡',
       'Steam 平台50元面值充值卡，购买后即时发送卡密，请在Steam客户端激活使用。',
       50.00, 'a0000000-0000-0000-0000-000000000001'::uuid, 5, false, true, 1, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE title = 'Steam 50元充值卡');

-- 商品2：Steam 100元充值卡（游戏充值分类）
INSERT INTO products (id, title, description, base_price, category_id, low_stock_threshold, wholesale_enabled, is_enabled, sort_order, is_deleted, created_at, updated_at)
SELECT 'b0000000-0000-0000-0000-000000000002'::uuid, 'Steam 100元充值卡',
       'Steam 平台100元面值充值卡，购买后即时发送卡密。',
       100.00, 'a0000000-0000-0000-0000-000000000001'::uuid, 5, false, true, 2, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE title = 'Steam 100元充值卡');

-- 商品3：Windows 11 Pro 激活码（软件激活分类）
INSERT INTO products (id, title, description, base_price, category_id, low_stock_threshold, wholesale_enabled, is_enabled, sort_order, is_deleted, created_at, updated_at)
SELECT 'b0000000-0000-0000-0000-000000000003'::uuid, 'Windows 11 Pro 激活码',
       'Windows 11 专业版正版激活码，支持全新安装和升级激活，永久有效。',
       298.00, 'a0000000-0000-0000-0000-000000000002'::uuid, 3, true, true, 1, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE title = 'Windows 11 Pro 激活码');

-- 商品4：Office 365 一年订阅（软件激活分类）
INSERT INTO products (id, title, description, base_price, category_id, low_stock_threshold, wholesale_enabled, is_enabled, sort_order, is_deleted, created_at, updated_at)
SELECT 'b0000000-0000-0000-0000-000000000004'::uuid, 'Office 365 一年订阅',
       'Microsoft 365 个人版一年订阅激活码，含 Word/Excel/PowerPoint 全套。',
       399.00, 'a0000000-0000-0000-0000-000000000002'::uuid, 3, false, true, 2, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE title = 'Office 365 一年订阅');

-- 商品5：Netflix 高级会员月卡（会员订阅分类）
INSERT INTO products (id, title, description, base_price, category_id, low_stock_threshold, wholesale_enabled, is_enabled, sort_order, is_deleted, created_at, updated_at)
SELECT 'b0000000-0000-0000-0000-000000000005'::uuid, 'Netflix 高级会员月卡',
       'Netflix Premium 高级会员一个月，支持4K HDR，最多4台设备同时观看。',
       89.00, 'a0000000-0000-0000-0000-000000000003'::uuid, 5, false, true, 1, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE title = 'Netflix 高级会员月卡');

-- 商品6：Spotify 会员季卡（会员订阅分类）
INSERT INTO products (id, title, description, base_price, category_id, low_stock_threshold, wholesale_enabled, is_enabled, sort_order, is_deleted, created_at, updated_at)
SELECT 'b0000000-0000-0000-0000-000000000006'::uuid, 'Spotify 会员季卡',
       'Spotify Premium 三个月会员卡，无广告畅听，支持离线下载。',
       78.00, 'a0000000-0000-0000-0000-000000000003'::uuid, 5, false, true, 2, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE title = 'Spotify 会员季卡');

-- 每个商品各插入 3 张测试卡密（库存）
INSERT INTO card_keys (id, product_id, content, status, created_at, updated_at)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001'::uuid, 'STEAM50-TEST-' || i, 'AVAILABLE', NOW(), NOW()
FROM generate_series(1, 3) AS i
WHERE NOT EXISTS (SELECT 1 FROM card_keys WHERE content = 'STEAM50-TEST-1' AND product_id = 'b0000000-0000-0000-0000-000000000001'::uuid);

INSERT INTO card_keys (id, product_id, content, status, created_at, updated_at)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002'::uuid, 'STEAM100-TEST-' || i, 'AVAILABLE', NOW(), NOW()
FROM generate_series(1, 3) AS i
WHERE NOT EXISTS (SELECT 1 FROM card_keys WHERE content = 'STEAM100-TEST-1' AND product_id = 'b0000000-0000-0000-0000-000000000002'::uuid);

INSERT INTO card_keys (id, product_id, content, status, created_at, updated_at)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000003'::uuid, 'WIN11PRO-TEST-' || i, 'AVAILABLE', NOW(), NOW()
FROM generate_series(1, 3) AS i
WHERE NOT EXISTS (SELECT 1 FROM card_keys WHERE content = 'WIN11PRO-TEST-1' AND product_id = 'b0000000-0000-0000-0000-000000000003'::uuid);

INSERT INTO card_keys (id, product_id, content, status, created_at, updated_at)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'OFFICE365-TEST-' || i, 'AVAILABLE', NOW(), NOW()
FROM generate_series(1, 3) AS i
WHERE NOT EXISTS (SELECT 1 FROM card_keys WHERE content = 'OFFICE365-TEST-1' AND product_id = 'b0000000-0000-0000-0000-000000000004'::uuid);

INSERT INTO card_keys (id, product_id, content, status, created_at, updated_at)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000005'::uuid, 'NETFLIX-TEST-' || i, 'AVAILABLE', NOW(), NOW()
FROM generate_series(1, 3) AS i
WHERE NOT EXISTS (SELECT 1 FROM card_keys WHERE content = 'NETFLIX-TEST-1' AND product_id = 'b0000000-0000-0000-0000-000000000005'::uuid);

INSERT INTO card_keys (id, product_id, content, status, created_at, updated_at)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000006'::uuid, 'SPOTIFY-TEST-' || i, 'AVAILABLE', NOW(), NOW()
FROM generate_series(1, 3) AS i
WHERE NOT EXISTS (SELECT 1 FROM card_keys WHERE content = 'SPOTIFY-TEST-1' AND product_id = 'b0000000-0000-0000-0000-000000000006'::uuid);

commit;