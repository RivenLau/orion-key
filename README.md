<div align="center">

# Orion Key

**自动化数字商品（卡密）发卡平台**

Automated Digital Goods Delivery Platform

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Java](https://img.shields.io/badge/Java-22-orange?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4-brightgreen?logo=springboot)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-336791?logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38bdf8?logo=tailwindcss&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-9+-f69220?logo=pnpm&logoColor=white)

简体中文 | [English](README.en.md)

</div>

---

## 截图预览

| 前台首页（亮色） | 前台首页（暗色） |
|:---:|:---:|
| ![首页-亮色](.github/assets/home-light.png) | ![首页-暗色](.github/assets/home-dark.png) |

| 管理后台（亮色） | 管理后台（暗色） |
|:---:|:---:|
| ![后台-亮色](.github/assets/admin-light.png) | ![后台-暗色](.github/assets/admin-dark.png) |

---

## 在线 Demo

> 演示环境已开放，可直接登录管理后台体验完整功能。

| | 地址 |
|---|---|
| 🛒 **前台** | <a href="https://www.orionkey-demo.com/" target="_blank" rel="noopener noreferrer">https://www.orionkey-demo.com/</a> |
| 🛠️ **管理后台** | <a href="https://www.orionkey-demo.com/admin" target="_blank" rel="noopener noreferrer">https://www.orionkey-demo.com/admin</a> |
| 🔑 **管理员账号** | `admin` / `123456` |

---

## 核心特性

|  |  |
|---|---|
| 🛒 **自动发卡** — 下单支付后自动发放卡密，零人工干预 | 🎨 **主题切换** — 支持亮色/暗色模式，多主题色自由切换 |
| 📦 **商品管理** — 分类、上下架、库存、批量导入卡密 | 🔒 **安全认证** — JWT 无状态认证 + BCrypt 加密 |
| 💳 **多支付渠道** — 可扩展的支付架构，支持微信/支付宝 | 🛡️ **风控系统** — IP 限流、登录防爆破、订单防刷 |
| 📊 **管理后台** — 仪表盘数据概览、订单/用户/站点全面管理 | 🔍 **订单追踪** — 订单号查询卡密，支持游客和会员 |
| 🛍️ **购物车** — 多商品合并下单，提升购买体验 | ⚙️ **站点配置** — 公告、弹窗、维护模式，后台一键开关 |

---

## 支付渠道集成

| 渠道            | 接入方式        | 说明             |
|---------------|-------------|----------------|
| 支付宝           | 易支付集成       | 通过第三方易支付平台接入   |
| 微信支付          | 易支付集成       | 通过第三方易支付平台接入   |
| 支付宝     | 原生接入（待实现）   | 需企商户资质 |
| 微信支付   | 原生接入（待实现）   | 需商户资质  |
| USDT (TRC-20) | BEpusdt 自托管 | 链上自动确认，无第三方托管  |
| USDT (BEP-20) | BEpusdt 自托管 | 链上自动确认，无第三方托管  |

> 支付架构可扩展，可通过后台「支付渠道管理」自由配置和切换。

💡 **易支付入驻推荐**：<a href="https://vip1.zhunfu.cn/user/?invite=X1NUVw" target="_blank" rel="noopener noreferrer">https://vip1.zhunfu.cn/user/?invite=X1NUVw</a>&emsp;·&emsp;通过该链接注册后，联系易支付客服 QQ：**440933**（备注 **1203**），可享受永久 **3%** 的超低提现手续费。

---

## 技术架构

| 层级 | 技术栈 |
|------|--------|
| **前端** | Next.js 16 · React 19 · TypeScript · Tailwind CSS 3 · shadcn/ui |
| **后端** | Spring Boot 3.4 · Java 22 · Spring Data JPA · Spring Security |
| **数据库** | PostgreSQL 18+ |
| **认证** | JWT (jjwt) · BCrypt |
| **构建** | pnpm (前端) · Maven (后端) |

### Monorepo 目录结构

> 基于 pnpm workspaces 的 Monorepo 架构，前后端统一管理。

```
orion-key/
├── apps/
│   ├── web/                          # Next.js 前端
│   │   ├── app/
│   │   │   ├── (store)/              # 前台路由组（首页、商品、购物车、订单、支付…）
│   │   │   └── admin/                # 管理后台路由组（仪表盘、商品/卡密/订单/用户管理…）
│   │   ├── features/                 # 业务功能模块
│   │   ├── services/                 # API 调用层（统一封装后端接口）
│   │   ├── hooks/                    # 自定义 React Hooks
│   │   ├── components/               # 通用 UI 组件（shadcn/ui）
│   │   ├── types/                    # TypeScript 类型定义
│   │   └── next.config.mjs           # Next.js 配置（含 API 代理 rewrites）
│   │
│   └── api/                          # Spring Boot 后端
│       └── src/main/
│           ├── java/com/orionkey/
│           │   ├── controller/       # REST 控制器（前台 + Admin）
│           │   ├── entity/           # JPA 实体（16 张表）
│           │   ├── repository/       # 数据访问层
│           │   ├── service/          # 业务逻辑层
│           │   ├── config/           # 安全、JWT、跨域等配置
│           │   └── model/            # DTO / VO
│           └── resources/
│               ├── application.yml   # 应用配置（数据库、JWT、邮件、上传等）
│               └── data.sql          # 初始化数据（管理员、站点配置、支付渠道）
│
├── docker-compose.yml                # Docker Compose 编排（生产 / 本地通用）
├── .env.example                      # 环境变量模板
└── pnpm-workspace.yaml               # Monorepo 工作区声明
```

---

## 先决条件

开始之前，请确保已安装以下工具：

| 工具 | 版本 | 说明 |
|------|------|------|
| Java | 22+ | 后端运行环境 |
| Maven | 3.9+ | 后端构建工具 |
| Node.js | 20+ | 前端运行环境 |
| pnpm | 9+ | 前端包管理（`npm i -g pnpm`） |
| PostgreSQL | 18+ | 数据库，需提前创建库和用户 |

---

## 配置

核心配置文件：`apps/api/src/main/resources/application.yml`

所有配置项均支持**环境变量覆盖**（格式 `${ENV_VAR:默认值}`），本地开发可直接修改 yml，生产环境建议通过环境变量注入。

### 数据库

```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/orion_key}
    username: ${DB_USERNAME:orionkey}
    password: ${DB_PASSWORD:your_password}
```

首次启动自动建表（`ddl-auto: update`），启动后执行一次初始化 SQL(data.sql文件) 写入管理员账户、站点配置：


> SQL 内置 `WHERE NOT EXISTS`，多次执行不会产生重复数据。

### JWT 认证

```yaml
jwt:
  secret: ${JWT_SECRET:<用 openssl rand -base64 48 生成>}
  expiration: 86400000  # 24 小时
```

生产环境**必须**通过 `JWT_SECRET` 环境变量注入随机密钥（至少 256 bits）：

```bash
openssl rand -base64 48
```

### 密码加密模式

```yaml
security:
  password-plain: ${PASSWORD_PLAIN:true}  # true=明文密码(开发用), false=BCrypt(生产用)
```

- **本地开发**：`true`（默认），密码明文存储，方便调试
- **生产环境**：设为 `false`，启用 BCrypt 加密，**必须在切换前重置所有用户密码**

### 邮件发送

```yaml
spring:
  mail:
    host: ${MAIL_HOST:smtp.example.com}
    port: ${MAIL_PORT:465}
    username: ${MAIL_USERNAME:your@email.com}
    password: ${MAIL_PASSWORD:your_password}

mail:
  enabled: ${MAIL_ENABLED:true}       # 邮件功能总开关，设为 false 可关闭所有邮件发送
  site-url: ${MAIL_SITE_URL:https://your-domain.com}
```

### 文件上传

```yaml
upload:
  path: ${UPLOAD_PATH:./uploads}                # 文件存储路径
  url-prefix: ${UPLOAD_URL_PREFIX:/api/uploads}  # 访问 URL 前缀
```

---

## 部署

> 完整生产部署（含服务器初始化、Nginx/HTTPS、CI/CD、BEpusdt USDT 支付等），本节仅给出最小启动路径。

### 方式一：Docker 部署（推荐）

仓库根目录提供 `docker-compose.yml`，编排 **api / web / bepusdt** 三个容器；**不含 PostgreSQL 和 Nginx**，需自行准备。

镜像已发布至 GHCR 公开仓库，默认 `:latest` tag 跟随最新 release，无需登录即可匿名拉取：

- `ghcr.io/rivenlau/orion-key-api:latest`
- `ghcr.io/rivenlau/orion-key-web:latest`

```bash
# 1. 准备 .env（变量含义见上方「配置」章节）
cp .env.example .env

# 2. 拉取镜像并启动
docker compose pull
docker compose up -d

# 3. 查看日志
docker compose logs -f
```

> 💡 **生产环境建议固定具体版本号**（如 `:v1.0.0`），在 `.env` 中通过 `API_IMAGE` / `WEB_IMAGE` 覆盖默认值，便于回滚和多机一致性。

> 上传文件通过卷挂载 `./uploads` 持久化，容器重建不丢失。生产环境建议前置 Nginx 反向代理处理 HTTPS 和静态资源。

### 方式二：非 Docker 部署（直接运行）

适合本地开发或单机直跑场景。需先安装 Java 22 / Maven 3.9+ / Node.js 20+ / pnpm 9+ / PostgreSQL 18+。

> ⚠️ **时区提醒**：Docker 部署时已通过 compose 文件注入 `TZ=Asia/Shanghai`；非 Docker 部署需自行确保进程时区正确，否则订单时间、过期判断、链上验证等会偏差 8 小时。任选其一：
>
> ```bash
> # 方式 A：改系统时区（一劳永逸，影响所有进程）
> sudo timedatectl set-timezone Asia/Shanghai
>
> # 方式 B：启动前注入 TZ 环境变量（仅影响当前进程）
> export TZ=Asia/Shanghai
> ```

```bash
# 后端（端口 8083）
cd apps/api
mvn spring-boot:run

# 前端（端口 3000，新开终端）
cd apps/web
pnpm install
pnpm dev
```

或在仓库根目录一键启动前端：

```bash
pnpm install
pnpm dev:web
```

> **API 代理**：`next.config.mjs` 已配置 `rewrites`，前端 `/api/*` 自动代理到 `http://localhost:8083`，无需手动处理跨域。

### 验证

- 健康检查：`GET http://localhost:8083/api/health`

---

## AI 商店推荐（非 Demo 演示）

[![Orion Key Shop](https://img.shields.io/badge/Orion%20Key%20Shop-在线商店-FF6B00?style=for-the-badge)](https://www.orionkey.shop/)

---

## TG 交流群组

[![Telegram](https://img.shields.io/badge/Telegram-群组-26A5E4?logo=telegram&logoColor=white)](https://t.me/+7Gx0vtwWixI3ODZh)

---

## 商务合作

**自动发卡网代建、商务合作联系 微信: Aarion666**

<p align="center">
  <img src=".github/assets/contact.jpg" alt="商务合作微信二维码" width="240" />
</p>

---

## Star History

<a href="https://star-history.com/#RivenLau/orion-key&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=RivenLau/orion-key&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=RivenLau/orion-key&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=RivenLau/orion-key&type=Date" />
  </picture>
</a>

---

## License

[MIT](LICENSE) © 2026 Riven
