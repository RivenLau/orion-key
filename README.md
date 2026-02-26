# Orion Key — 自动发卡平台

自动化数字商品（卡密）发卡平台。

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | Next.js 16 + React 19 + TypeScript + Tailwind CSS 3 + shadcn/ui |
| 后端 | Spring Boot 3.4 + Java 22 + Spring Data JPA + Spring Security |
| 数据库 | PostgreSQL |
| 认证 | JWT (jjwt) + BCrypt |
| 验证码 | hutool-captcha |
| 构建 | pnpm (前端) + Maven (后端) |

## 项目结构

```
orion-key/
├── apps/
│   ├── web/                    # Next.js 前端
│   └── api/                    # Spring Boot 后端
├── packages/
│   └── openapi/
│       └── openapi.yaml        # API 契约（单一数据源）
├── docs/                       # 设计文档与开发规范
├── pnpm-workspace.yaml
```

## 环境要求

| 工具 | 版本 |
|------|------|
| Java | 22+ |
| Maven | 3.9+ |
| Node.js | 20+ |
| pnpm | 9+ |
| PostgreSQL | 14+ |

---

## 快速开始（本地开发）

### 1. 创建数据库

```bash
# 登录 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE orion_key;

# 创建用户（可选，也可用 postgres 超级用户）
CREATE USER orionkey WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE orion_key TO orionkey;
```

### 2. 配置后端

编辑 `apps/api/src/main/resources/application.yml`，修改数据库连接：

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/orion_key
    username: orionkey          # 改为你的用户名
    password: your_password     # 改为你的密码
```

> 首次启动会自动建表（`ddl-auto: update`），但不会自动写入初始数据，需手动执行一次。

### 3. 初始化数据（仅首次）

首次启动后，手动执行一次 `data.sql` 写入管理员账户、站点配置、支付渠道等基础数据：

```bash
psql -U orionkey -d orion_key -f apps/api/src/main/resources/data.sql
```

> SQL 内置了 `WHERE NOT EXISTS` 防重，误执行多次也不会产生重复数据。

### 4. 启动后端

```bash
cd apps/api
mvn spring-boot:run
```

后端启动于 `http://localhost:8083/api`

### 5. 启动前端

```bash
cd apps/web
pnpm install
pnpm dev
```

前端启动于 `http://localhost:3000`

> **API 代理**：`next.config.mjs` 已配置 `rewrites`，前端对 `/api/*` 的请求会自动代理到 `http://localhost:8083`，无需手动处理跨域。如后端端口不同，设置环境变量 `BACKEND_URL=http://localhost:端口号`。

### 6. 验证

- 后端健康检查：`GET http://localhost:8083/api/categories`
- 管理员登录：用户名 `admin`，密码 `admin123`

---

## 初始化数据说明

`data.sql` 位于 `apps/api/src/main/resources/data.sql`，需在首次部署时**手动执行一次**：

```bash
psql -U orionkey -d orion_key -f apps/api/src/main/resources/data.sql
```

写入内容：

| 数据 | 说明 |
|------|------|
| 管理员账户 | `admin` / `admin123` (BCrypt)，角色 ADMIN |
| 站点配置 (13项) | 站点名称、积分开关、限流参数、订单过期时间等 |
| 支付渠道 (2个) | 微信支付、支付宝（桩实现，待接入真实支付） |

> SQL 内置 `WHERE NOT EXISTS`，多次执行不会产生重复数据。

---

## 生产部署（Ubuntu）

### 1. 安装依赖

```bash
# Java 22
sudo apt install openjdk-22-jdk -y

# PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# 创建数据库
sudo -u postgres psql -c "CREATE DATABASE orion_key;"
sudo -u postgres psql -c "CREATE USER orionkey WITH PASSWORD 'your_strong_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE orion_key TO orionkey;"
```

### 2. 创建上传目录

```bash
sudo mkdir -p /data/orion-key/uploads
sudo chown your_app_user:your_app_user /data/orion-key/uploads
```

图片上传后保存在此目录，与应用解耦，重启/重新部署不会丢失。

### 3. 构建

```bash
# 后端
cd apps/api
mvn clean package -DskipTests
# 产物: target/orion-key-1.0.0-SNAPSHOT.jar

# 前端
cd apps/web
pnpm install
pnpm build
```

### 4. 配置环境变量

建议通过环境变量覆盖敏感配置，而非修改 yml 文件：

```bash
# 必须配置
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/orion_key
export SPRING_DATASOURCE_USERNAME=orionkey
export SPRING_DATASOURCE_PASSWORD=your_strong_password
export JWT_SECRET=至少32字符的随机字符串_用openssl_rand_base64_32生成

# 可选配置（有默认值）
export UPLOAD_PATH=/data/orion-key/uploads    # 默认 /data/orion-key/uploads
export SERVER_PORT=8083                        # 默认 8083
```

生成安全的 JWT Secret：

```bash
openssl rand -base64 32
```

### 5. 初始化数据（仅首次部署）

首次启动前，先启动一次应用让 JPA 自动建表，然后执行初始化 SQL：

```bash
# 先启动一次让 JPA 建表（启动成功后 Ctrl+C 停掉即可）
java -jar target/orion-key-1.0.0-SNAPSHOT.jar

# 执行初始化数据
psql -U orionkey -d orion_key -f apps/api/src/main/resources/data.sql
```

### 6. 启动后端

```bash
java -jar apps/api/target/orion-key-1.0.0-SNAPSHOT.jar
```

### 7. Systemd 服务（推荐）

创建 `/etc/systemd/system/orion-key.service`：

```ini
[Unit]
Description=Orion Key API
After=network.target postgresql.service

[Service]
Type=simple
User=your_app_user
WorkingDirectory=/opt/orion-key
ExecStart=/usr/bin/java -jar /opt/orion-key/orion-key.jar
Restart=always
RestartSec=10

Environment=SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/orion_key
Environment=SPRING_DATASOURCE_USERNAME=orionkey
Environment=SPRING_DATASOURCE_PASSWORD=your_strong_password
Environment=JWT_SECRET=your_jwt_secret_here
Environment=UPLOAD_PATH=/data/orion-key/uploads

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable orion-key
sudo systemctl start orion-key

# 查看日志
journalctl -u orion-key -f
```

### 8. 启动前端

```bash
cd apps/web
pnpm install
pnpm build
pnpm start  # 默认 3000 端口
```

> 也可用 PM2 管理前端进程：`pm2 start npm --name "orion-web" -- start`

### 9. Nginx 反向代理（推荐）

生产环境用 Nginx 统一入口，将前端和后端挂在同一域名下，避免跨域问题：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 上传的图片 — 直接由 Nginx 提供静态文件服务
    location /uploads/ {
        alias /data/orion-key/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 后端 API — 代理到 Spring Boot
    location /api/ {
        proxy_pass http://127.0.0.1:8083;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 前端 — 代理到 Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/orion-key /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> 添加 HTTPS：使用 `certbot --nginx -d your-domain.com` 自动配置 Let's Encrypt 证书。

---

## CI/CD（GitHub Actions）

项目为前后端分离架构，CI/CD 建议使用 GitHub Actions + Self-hosted Runner（部署在服务器上）：

### 工作原理

```
GitHub Push → GitHub Actions → Self-hosted Runner（服务器上）→ 构建 + 部署
```

前端的 `API_BASE` 始终为 `/api`（相对路径），由 Nginx 统一路由到后端，因此 **无需在 CI/CD 中硬编码后端地址**。

### 示例 workflow（`.github/workflows/deploy.yml`）

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: self-hosted  # 服务器上的 Runner

    steps:
      - uses: actions/checkout@v4

      # 后端构建
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 22

      - name: Build backend
        run: |
          cd apps/api
          mvn clean package -DskipTests

      - name: Restart backend
        run: |
          sudo systemctl restart orion-key

      # 前端构建
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Build frontend
        run: |
          cd apps/web
          pnpm install --frozen-lockfile
          pnpm build

      - name: Restart frontend
        run: |
          pm2 restart orion-web || pm2 start npm --name "orion-web" -- start --prefix apps/web
```

### Self-hosted Runner 安装

```bash
# 在服务器上
mkdir ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/你的用户名/orion-key --token 从GitHub获取
sudo ./svc.sh install && sudo ./svc.sh start
```

> Runner token 从 GitHub 仓库 → Settings → Actions → Runners → New self-hosted runner 获取。

### 架构总结

| 环境 | 前端如何到达后端 API |
|------|---------------------|
| **本地开发** | Next.js `rewrites` 代理 `/api/*` → `localhost:8083` |
| **生产部署** | Nginx 反向代理 `/api/*` → `127.0.0.1:8083` |
| **CI/CD** | Runner 在服务器本地构建部署，无需处理网络路由 |

---

## 配置项速查

### application.yml 关键配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `server.port` | 8083 | 后端端口 |
| `server.servlet.context-path` | /api | API 前缀 |
| `spring.datasource.url` | - | PostgreSQL 连接地址 |
| `spring.jpa.hibernate.ddl-auto` | update | 自动建表/更新表结构 |
| `jwt.secret` | 开发默认值 | **生产必须替换** |
| `jwt.expiration` | 86400000 | Token 有效期（毫秒），默认 24 小时 |
| `upload.path` | /data/orion-key/uploads | 图片上传存储路径 |
| `security.password-plain` | false | `true`=明文密码（开发用），`false`=BCrypt（生产用） |

### data.sql 站点配置

| config_key | 默认值 | 说明 |
|------------|--------|------|
| `site_name` | Orion Key | 站点名称，显示在标题和 Header |
| `site_description` | 自动化数字商品发卡平台 | 首页副标题 / SEO 描述 |
| `points_enabled` | true | 积分功能总开关 |
| `points_rate` | 1 | 每消费 1 元获得的积分数 |
| `maintenance_enabled` | false | 维护模式，开启后非管理员返回 503 |
| `announcement_enabled` | false | 全站公告开关 |
| `popup_enabled` | false | 弹窗通知开关 |
| `rate_limit_per_second` | 50 | 单 IP 每秒最大请求数 |
| `login_attempt_limit` | 10 | 单账号连续登录失败上限 |
| `max_purchase_per_user` | 999 | 单用户最大累计购买数量 |
| `max_pending_orders_per_ip` | 20 | 单 IP 最大未支付订单数 |
| `max_pending_orders_per_user` | 10 | 单用户最大未支付订单数 |
| `order_expire_minutes` | 30 | 未支付订单自动过期时间（分钟） |

---

## 生产部署检查清单

- [ ] PostgreSQL 已安装并创建数据库
- [ ] 数据库连接信息已通过环境变量配置
- [ ] `JWT_SECRET` 已替换为随机强密码（`openssl rand -base64 32`）
- [ ] 上传目录 `/data/orion-key/uploads` 已创建并设置正确权限
- [ ] 已执行 `data.sql` 初始化基础数据（仅首次）
- [ ] 首次启动后登录管理后台，**立即修改 admin 密码**
- [ ] `ddl-auto` 生产稳定后考虑改为 `validate`（只校验不自动改表）
- [ ] 后端通过 systemd 服务运行
- [ ] 前端通过 `pnpm build && pnpm start` 或 PM2 运行
- [ ] Nginx 反向代理已配置（`/api/` → 8083，`/` → 3000，`/uploads/` → 静态目录）
- [ ] HTTPS 已配置（`certbot --nginx`）
- [ ] （可选）GitHub Actions Self-hosted Runner 已安装
