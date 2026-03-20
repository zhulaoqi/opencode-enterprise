# OpenCode Enterprise Platform — 启动 · 部署 · 测试指南

---

## 1. 项目结构

```
opencode/                      ← 项目根目录（monorepo）
├── packages/
│   ├── opencode/              # OpenCode Core（AI 引擎 + SessionHooks）
│   ├── platform/              # 企业平台后端（Hono API + Worker Manager）
│   └── dashboard/             # 企业 Web Dashboard（Solid.js + Vite）
├── nginx/                     # 生产环境 nginx 反向代理配置
├── docker/                    # PgBouncer 等基础设施配置
├── package.json               # 根 workspace 配置
└── bun.lock                   # 依赖锁文件
```

**架构概览**：

采用 **Worker-per-User** 架构。每个登录用户获得一个独立的 OpenCode 工作节点（进程或 Docker 容器），由 Platform Worker Manager 统一管理。前端直连 Worker 进行 AI 对话，Platform 只负责管理层（认证、计费、MCP、模型配置）。

**运行时组件**：

| 组件 | 启动命令 | 端口 | 说明 |
|------|----------|------|------|
| Platform Server | `bun run dev` (platform) | **3100** | REST API + WebSocket + Worker Manager |
| Worker（每用户） | 自动由 Platform 启动 | **4200+** | 独立的 OpenCode 实例，处理 AI 对话 |
| Dashboard Dev | `bun run dev` (dashboard) | **3200** | Vite 开发服务器，自动代理 API |
| PostgreSQL | 独立服务 | **5432** | 全局管理数据（用户、配额、MCP、模型） |
| Redis | 独立服务 | **6379** | Worker 注册表 / 配额缓存 / 发布订阅 |
| PgBouncer | 独立服务（生产） | **6432** | PostgreSQL 连接池（生产环境推荐） |

---

## 2. 前置要求

### 2.1 运行时

| 工具 | 最低版本 | 安装方式 |
|------|----------|----------|
| **Bun** | >= 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| **PostgreSQL** | >= 15 | 系统包管理器 / Docker / 云服务 |
| **Redis** | >= 7 | 系统包管理器 / Docker / 云服务 |

### 2.2 用 Docker 快速启动基础设施（推荐）

如果本机没有 PostgreSQL 和 Redis，用 Docker 一键启动：

```bash
# 启动 PostgreSQL（用户名 opencode，密码 opencode，数据库 opencode）
docker run -d \
  --name opencode-pg \
  -e POSTGRES_USER=opencode \
  -e POSTGRES_PASSWORD=opencode \
  -e POSTGRES_DB=opencode \
  -p 5432:5432 \
  postgres:16-alpine

# 启动 Redis
docker run -d \
  --name opencode-redis \
  -p 6379:6379 \
  redis:7-alpine

# 验证
docker ps  # 应该能看到 opencode-pg 和 opencode-redis 两个容器
```

---

## 3. 本地开发 — 分步指南

### 第一步：克隆项目并安装依赖

```bash
git clone <仓库地址>
cd opencode

# 安装全部 workspace 依赖（在项目根目录执行）
bun install
```

> `bun install` 必须在**项目根目录** `opencode/` 下执行，它会自动安装所有 workspace 包（opencode、platform、dashboard）的依赖。

### 第二步：创建环境变量文件

```bash
# 进入 platform 包目录
cd packages/platform

# 创建 .env 文件
cat > .env << 'EOF'
# ========== 必填 ==========
ENTERPRISE_MODE=true
DATABASE_URL=postgres://opencode:opencode@localhost:5432/opencode
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-to-a-random-string-at-least-32-chars

# ========== 飞书集成（本地开发可填任意值） ==========
FEISHU_APP_ID=cli_dev_placeholder
FEISHU_APP_SECRET=dev_placeholder_secret

# ========== AI 模型（Worker 需要） ==========
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# ========== 可选配置 ==========
# JWT_EXPIRY=2h                       # JWT 过期时间，默认 2h
# FEISHU_ENCRYPT_KEY=xxx              # 飞书事件加密 key（来源见下方说明）
# FEISHU_VERIFICATION_TOKEN=xxx       # 飞书 webhook 验证 token（来源见下方说明）
# DASHBOARD_URL=http://localhost:3200  # Dashboard 地址
# PORT=3100                           # API 服务端口，默认 3100
# WORKER_CONCURRENCY=4                # Worker 并发数，默认 4
EOF
```

**环境变量说明**：

| 变量 | 必填 | 说明 | 来源 / 示例 |
|------|------|------|-------------|
| `ENTERPRISE_MODE` | 是 | 启用企业模式 | 固定填 `true` |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 | `postgres://user:pass@host:5432/dbname` |
| `REDIS_URL` | 是 | Redis 连接串 | `redis://localhost:6379` |
| `JWT_SECRET` | 是 | JWT 签名密钥，至少 32 字符 | 自己生成随机字符串 |
| `FEISHU_APP_ID` | 是 | 飞书应用 App ID | 飞书开放平台 → 应用 → **凭证与基础信息** 页面 |
| `FEISHU_APP_SECRET` | 是 | 飞书应用 App Secret | 飞书开放平台 → 应用 → **凭证与基础信息** 页面 |
| `OPENAI_API_KEY` | 否 | LLM API Key | OpenAI / 第三方中转平台获取 |
| `OPENAI_BASE_URL` | 否 | LLM API 地址 | 默认 `https://api.openai.com/v1`，可改为中转地址 |
| `LLM_MODEL` | 否 | 默认 LLM 模型名 | 默认 `gpt-4o-mini`，可填任何兼容 OpenAI 格式的模型 |
| `FEISHU_ENCRYPT_KEY` | 否 | 飞书事件回调加密 Key | 飞书开放平台 → 应用 → **事件与回调** → **加密策略** 中的 Encrypt Key |
| `FEISHU_VERIFICATION_TOKEN` | 否 | 飞书 Webhook 验证 Token | 飞书开放平台 → 应用 → **事件与回调** → **加密策略** 中的 Verification Token |
| `JWT_EXPIRY` | 否 | JWT 过期时间 | 默认 `2h` |
| `DASHBOARD_URL` | 否 | Dashboard 外部访问地址 | 默认 `http://localhost:3200` |
| `PORT` | 否 | API 服务端口 | 默认 `3100` |
| `WORKER_MODE` | 否 | Worker 运行模式 | `process`（默认）或 `docker` |
| `MAX_WORKERS` | 否 | 最大 Worker 数量 | 默认 `200` |
| `WORKER_IDLE_MS` | 否 | Worker 空闲超时 | 默认 `1800000`（30 分钟） |
| `WORKER_BASE_URL` | 否 | 生产环境 Worker 基础 URL | 如 `https://your-domain.com/w` |

> **FEISHU_ENCRYPT_KEY / FEISHU_VERIFICATION_TOKEN 获取路径**：
> 1. 打开 [飞书开放平台](https://open.feishu.cn/app) → 进入你的应用
> 2. 左侧菜单 → **事件与回调**
> 3. 页面顶部 → **加密策略** 区域
> 4. 其中 **Encrypt Key** 和 **Verification Token** 两个值就是
> 5. 这两个参数**仅在启用飞书机器人/事件回调时需要**，纯网页登录不需要

### 第三步：初始化数据库

**首先创建数据库**（PostgreSQL 不会自动创建）：

```bash
# 方式一：如果 PostgreSQL 跑在 Docker 中（推荐）
# 替换 <容器名> 和 <用户名> 为你的实际值
docker exec <容器名> psql -U <用户名> -d postgres -c "CREATE DATABASE opencode;"

# 例如你的容器叫 postgresql，用户名是 root：
docker exec postgresql psql -U root -d postgres -c "CREATE DATABASE opencode;"

# 方式二：如果本机装了 psql 客户端
psql -h localhost -U root -d postgres -c "CREATE DATABASE opencode;"
```

**然后推送 schema 到数据库**：

```bash
# 确保在 packages/platform 目录下
cd opencode/packages/platform

# 生成 Drizzle 迁移文件（根据 src/**/*.sql.ts schema 生成 SQL）
bun run db generate

# 将 schema 推送到 PostgreSQL（创建所有表）
bun run db push
```

预期输出：
```
[✓] Changes applied
```

**验证表已创建**：

```bash
docker exec <容器名> psql -U <用户名> -d opencode -c "\dt"

# 应看到 15 张表：
# identity_mapping, role, user_role, department_role,
# enterprise_session, enterprise_message, enterprise_tool_log,
# mcp_registry, mcp_authorization, mcp_group,
# quota_config, quota_usage, audit_log,
# llm_model, channel_config
```

> **数据库说明**：
> - 使用 **PostgreSQL >= 15**（不是 MySQL / SQLite）
> - ORM 为 **Drizzle ORM**，schema 定义在 `src/**/*.sql.ts` 文件中
> - `drizzle.config.ts` 通过 `process.env.DATABASE_URL` 读取连接串，需要 `.env` 先配好

### 第四步：启动服务（开 2 个终端）

**终端 1 — Platform Server**（后端 API + Worker Manager）：

```bash
cd opencode/packages/platform
bun run dev
```

预期输出：
```
[platform] hooks registered with OpenCode SessionHooks
[pool] started max=200 idle=1800000ms
[platform] starting on :3100
```

> Worker Manager 已内置在 Platform 中，用户登录后会自动为其启动独立的 OpenCode Worker 进程。无需手动启动 Worker。

**终端 2 — Dashboard 前端**：

```bash
cd opencode/packages/dashboard
bun run dev
```

预期输出：
```
VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3200/
```

> Dashboard Vite 开发服务器已配置代理：`/api` → `http://localhost:3100`。前端直接访问 `http://localhost:3200` 即可。对话数据通过 Worker 的 SSE 接口实时推送。

### 第五步：验证服务正常

```bash
# 1. 健康检查（应返回 {"status":"ok","time":"..."}）
curl http://localhost:3100/health

# 2. 打开 Dashboard
open http://localhost:3200

# 3.（可选）测试 WebSocket
# 安装 wscat: npm install -g wscat
wscat -c "ws://localhost:3100/ws?token=YOUR_JWT_TOKEN"
```

---

## 4. 测试

### 4.1 运行后端测试

```bash
cd opencode/packages/platform
bun test
```

预期输出：
```
 24 pass
 0 fail
 29 expect() calls
Ran 24 tests across 9 files. [~1500ms]
```

### 4.2 类型检查（3 个包分别执行）

```bash
# OpenCode Core
cd opencode/packages/opencode
bun typecheck

# Platform 后端
cd opencode/packages/platform
bun typecheck

# Dashboard 前端
cd opencode/packages/dashboard
bun typecheck
```

三个包都应输出无错误。

### 4.3 前端构建验证

```bash
cd opencode/packages/dashboard
bun run build
```

预期输出：
```
✓ built in ~7s
```

构建产物在 `packages/dashboard/dist/` 目录下。

### 4.4 测试用例清单

| 测试文件 | 模块 | 用例数 |
|----------|------|--------|
| `test/auth/jwt.test.ts` | JWT 签发 / 校验 / 刷新 | 3 |
| `test/rbac/permission.test.ts` | RBAC 权限引擎 | 6 |
| `test/mcp-manager/resolver.test.ts` | MCP 工具解析（按角色/部门） | 5 |
| `test/mcp-manager/registry.test.ts` | MCP 注册表可见性 | 1 |
| `test/billing/quota.test.ts` | 配额 Key 格式（日/月） | 2 |
| `test/billing/rate-limit.test.ts` | 滑窗限流 Key 格式 | 1 |
| `test/billing/circuit-breaker.test.ts` | 熔断器状态流转 | 2 |
| `test/billing/cost.test.ts` | Token 成本计算 | 1 |
| `test/im-adapter/feishu-webhook.test.ts` | 飞书 Webhook 验签 | 2 |
| **合计** | | **24** |

---

## 5. Docker 镜像构建与部署

### 5.1 镜像说明

| 镜像 | Dockerfile | 说明 |
|------|-----------|------|
| `opencode-platform` | `Dockerfile.api` | Platform Server（API + Worker Manager） |
| `opencode-worker` | `packages/platform/worker.Dockerfile` | 单个 OpenCode Worker 实例 |
| `opencode-dashboard` | `Dockerfile.dashboard` | Dashboard 静态资源 |

### 5.2 构建镜像

```bash
# 在项目根目录 opencode/ 下执行

# 构建 Platform Server 镜像
cat > Dockerfile.api << 'DOCKERFILE'
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/opencode/package.json packages/opencode/
COPY packages/platform/package.json packages/platform/
COPY packages/dashboard/package.json packages/dashboard/
RUN bun install --frozen-lockfile
COPY . .

FROM oven/bun:1
WORKDIR /app
COPY --from=build /app .
EXPOSE 3100
CMD ["bun", "run", "packages/platform/src/index.ts"]
DOCKERFILE

docker build -f Dockerfile.api -t opencode-platform:latest .

# 构建 Worker 镜像（Worker-per-User，由 Platform 按需启动）
docker build -f packages/platform/worker.Dockerfile -t opencode-worker:latest .

# 构建 Dashboard 镜像
cat > Dockerfile.dashboard << 'DOCKERFILE'
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/opencode/package.json packages/opencode/
COPY packages/platform/package.json packages/platform/
COPY packages/dashboard/package.json packages/dashboard/
RUN bun install --frozen-lockfile
COPY . .
RUN cd packages/dashboard && bun run build

FROM nginx:1.27-alpine
COPY --from=build /app/packages/dashboard/dist /usr/share/nginx/html
COPY nginx/worker.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

docker build -f Dockerfile.dashboard -t opencode-dashboard:latest .
```

### 5.3 Worker-per-User 架构说明

在 Docker 模式下（`WORKER_MODE=docker`），Platform 会为每个登录用户动态启动一个 `opencode-worker` 容器：

- 用户首次登录时，Platform 调用 `docker run` 启动一个 Worker 容器
- 容器通过 `--network host` 监听动态分配的端口（4200+）
- Worker 空闲超过 `WORKER_IDLE_MS`（默认 30 分钟）后自动回收
- 最大同时在线 Worker 数受 `MAX_WORKERS` 限制（默认 200）

### 5.4 用 Docker Compose 一键启动

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: opencode
      POSTGRES_PASSWORD: opencode
      POSTGRES_DB: opencode
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory-policy noeviction
    ports:
      - "6379:6379"

  pgbouncer:
    image: edoburu/pgbouncer
    volumes:
      - ./docker/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini
    ports:
      - "6432:6432"
    depends_on:
      - postgres

  platform:
    image: opencode-platform:latest
    ports:
      - "3100:3100"
    environment:
      ENTERPRISE_MODE: "true"
      DATABASE_URL: postgres://opencode:opencode@pgbouncer:6432/opencode
      REDIS_URL: redis://redis:6379
      JWT_SECRET: change-me-to-a-random-string-at-least-32-chars
      FEISHU_APP_ID: cli_xxx
      FEISHU_APP_SECRET: xxx
      OPENAI_API_KEY: sk-your-key
      WORKER_MODE: docker
      MAX_WORKERS: "200"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - workers:/data/workers
    depends_on:
      - pgbouncer
      - redis

  dashboard:
    image: opencode-dashboard:latest
    ports:
      - "80:80"

volumes:
  pgdata:
  workers:
```

```bash
docker compose up -d
docker compose logs -f platform
docker compose down
```

---

## 6. 生产部署（nginx + Docker）

### 6.1 nginx 反向代理

生产环境使用 nginx 统一入口，动态路由到 Worker：

```
nginx/worker.conf  ← 已包含在项目中
```

核心路由：
- `/` → Dashboard 静态资源
- `/api/` → Platform Server（认证、管理 API）
- `/w/{uid}/...` → 动态路由到用户 Worker（通过 auth_request 解析端口）
- `/ws` → Platform WebSocket（通知、状态推送）

### 6.2 PgBouncer 连接池

Worker-per-User 架构下每个 Worker 都需要连接 PostgreSQL。推荐使用 PgBouncer 做连接池：

```
docker/pgbouncer.ini  ← 已包含在项目中
```

配置说明：
- `pool_mode = transaction` — 事务级别复用，适合短查询
- `max_client_conn = 2000` — 支持最多 2000 个 Worker 连接
- `default_pool_size = 50` — 实际到 PostgreSQL 的连接数

Workers 和 Platform 连接 PgBouncer (:6432) 而非直连 PostgreSQL (:5432)。

### 6.3 Worker 生命周期管理

| 参数 | 环境变量 | 默认值 | 说明 |
|------|----------|--------|------|
| 运行模式 | `WORKER_MODE` | `process` | `process`=子进程，`docker`=Docker 容器 |
| 最大 Worker 数 | `MAX_WORKERS` | `200` | 超过后 LRU 淘汰最不活跃的 |
| 空闲超时 | `WORKER_IDLE_MS` | `1800000` | 30 分钟无活动自动回收 |
| Worker 基础 URL | `WORKER_BASE_URL` | — | 生产环境填，如 `https://domain.com/w` |

Pool Manager 每 60 秒扫描一次，回收空闲和超量 Worker。

### 6.4 监控

每个 Worker 暴露健康检查端点：

```bash
curl http://localhost:{worker_port}/global/health
```

通过 Redis 查看活跃 Worker：

```bash
redis-cli KEYS "worker:*"
redis-cli GET "worker:{userId}"
```

---

## 7. API 路由参考

### Platform API（/api/）

管理层接口，通过 JWT 认证。

```
GET  /health                              健康检查

POST /api/auth/feishu/callback            飞书 OAuth 回调
POST /api/auth/refresh                    JWT 刷新
GET  /api/auth/me                         当前用户信息

GET  /api/worker/connect                  获取用户 Worker URL + 密钥
GET  /api/worker/resolve?uid=             内部：nginx 解析 Worker 端口

GET  /api/mcp/market                      MCP 市场列表
POST /api/mcp                             注册新 MCP
PUT  /api/mcp/:id                         更新 MCP
GET  /api/mcp/:id                         MCP 详情 + 授权列表
GET  /api/mcp/:id/health                  MCP 健康状态
GET  /api/mcp/:id/tools                   工具列表及调用统计
GET  /api/mcp/:id/usage?days=7            用量趋势
POST /api/mcp/:id/authorize               添加授权
DELETE /api/mcp/:id/authorize             撤销授权

GET  /api/admin/users                     用户列表（支持 ?search=&role=&status=）
PUT  /api/admin/users/:id/roles           修改用户角色

GET  /api/billing/quotas-with-usage       配额列表（含实时用量）
POST /api/billing/quotas                  创建/更新配额规则

GET  /api/dashboard/overview?range=       概览 KPI
GET  /api/dashboard/trend?days=30         Token 使用日趋势
GET  /api/dashboard/active-users          活跃用户排行
GET  /api/dashboard/mcp-leaderboard       MCP 使用排行
GET  /api/dashboard/model-distribution    模型分布
GET  /api/dashboard/top-tools?days=30     工具调用排行
GET  /api/dashboard/recent-activity       最近活动

GET  /api/models                          可用模型列表
POST /api/models/admin                    新增模型
PUT  /api/models/admin/reorder            模型排序
PUT  /api/models/admin/:id               编辑模型
DELETE /api/models/admin/:id             删除模型

GET    /api/admin/channels               外部渠道列表
PUT    /api/admin/channels/:type         配置渠道
DELETE /api/admin/channels/:type         删除渠道
POST   /api/admin/channels/:type/test    测试渠道连接

POST /api/im/feishu/webhook               飞书事件回调
POST /api/im/feishu/card-action           飞书卡片按钮回调

WS   /ws?token=JWT                        WebSocket 通知推送
```

### Worker API（直连 Worker）

对话层接口，通过 Worker Secret（Basic Auth）认证。前端登录后从 `/api/worker/connect` 获取 URL 和密钥。

```
GET  /session/                            会话列表
POST /session/                            创建会话
GET  /session/:id/message                 消息历史
POST /session/:id/prompt_async            发送消息（异步）
POST /session/:id/abort                   中止生成
DELETE /session/:id                       删除会话
GET  /event?password=SECRET               SSE 实时事件流
GET  /global/health                       Worker 健康检查
```

---

## 8. 实时通信协议

### 8.1 Worker SSE（对话流）

前端通过 Worker 的 `/event` SSE 端点接收实时对话事件。EventSource 自动重连。

常见事件类型：
| type | 说明 |
|------|------|
| `session.prompt.completed` | 对话完成 |
| `session.prompt.error` | 对话出错 |
| `session.updated` | 会话状态更新 |

### 8.2 Platform WebSocket（管理通知）

Platform 仍保留 WebSocket 用于管理层通知（MCP 变更、配额警告）。

| type | 字段 | 说明 |
|------|------|------|
| `mcp_change` | `added[]`, `removed[]` | MCP 工具列表变更通知 |
| `quota_warning` | `remaining_pct`, `message` | 配额即将用尽警告 |
| `ping` / `pong` | — | 心跳 |

---

## 9. Hook 系统

OpenCode Core 定义 6 个 hook，Platform 全部实现并注册：

| Hook | 触发时机 | Platform 实现 |
|------|----------|---------------|
| `beforePrompt` | LLM 调用前 | 多级配额检查 + 滑窗限流 |
| `afterToolResolve` | 工具列表解析后 | 按用户 MCP 授权过滤可用工具 |
| `onToolCall` | 工具执行前 | 熔断器前置检查（OPEN 则拒绝）+ 调用计数 |
| `onToolResult` | 工具返回后 | 熔断器成功回报 + 审计日志 |
| `onTokenUsage` | Token 使用统计 | 配额递增 + 成本计算 + 审计日志 |
| `onMcpToolsChanged` | MCP 工具列表变更 | 通过 WebSocket 推送变更通知给用户 |

---

## 10. 外部消息渠道配置（飞书 / 钉钉 / 企微）

平台支持通过 IM Bot 接入 AI 对话能力。管理员可在 **设置 → 外部消息渠道** 中可视化配置，无需修改环境变量。

### 10.1 飞书 Bot 接入步骤

#### 第一步：创建飞书应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app) → 创建企业自建应用
2. 进入应用 → **凭证与基础信息** → 记录 `App ID` 和 `App Secret`
3. 进入 **事件与回调** → **加密策略**：
   - 记录 `Verification Token`（可选，用于验签）
   - 记录 `Encrypt Key`（可选，用于加密）

#### 第二步：配置事件回调地址

在飞书应用 → **事件与回调** → **事件配置** 中：

```
请求地址 URL：https://你的域名/api/im/feishu/webhook
```

> 本地开发时可用 `http://localhost:3100/api/im/feishu/webhook`，但飞书需要公网可达的地址。
> 可使用 ngrok、Cloudflare Tunnel 等工具暴露本地端口。

#### 第三步：添加权限

在飞书应用 → **权限管理** 中申请以下权限：

| 权限 | 说明 |
|------|------|
| `im:message:receive_v1` | 接收群聊/私聊消息 |
| `im:message:send_v1` | 发送消息 |
| `contact:user.base:readonly` | 获取用户基本信息（用于自动注册） |

申请后需 **发布版本** 并由管理员审批。

#### 第四步：在平台中配置

1. 登录 Dashboard → **设置** 页面
2. 找到 **外部消息渠道** → **飞书 Bot** → 点击 **配置**
3. 填入 `App ID`、`App Secret`，可选填 `Verification Token` 和 `Encrypt Key`
4. 开启 **免登自动注册**（推荐）：飞书用户 @Bot 时自动创建系统账号
5. 保存后点击 **测试连接**，验证凭证有效
6. 点击启用开关，完成

#### 第五步：验证

在飞书中私聊 Bot 或在群聊中 @Bot 发送一条消息，Bot 应回复 AI 生成的内容。

### 10.2 配置优先级

平台支持两种配置方式，数据库配置优先：

```
读取飞书配置：
1. 查询 channel_config 表（通过 Dashboard 配置写入）
2. 如果有记录且 enabled = true → 使用数据库配置
3. 如果没有记录 → 回退到 .env 中的 FEISHU_APP_ID / FEISHU_APP_SECRET
```

这意味着：
- **推荐方式**：在 Dashboard 设置页面配置（可视化、可测试、可启停）
- **兼容方式**：在 `.env` 中配置（适合 CI/CD 或不使用 Dashboard 的场景）

### 10.3 免登自动注册

开启后，飞书用户首次 @Bot 时，系统会：

1. 通过飞书 API 获取用户信息（姓名、头像、邮箱）
2. 自动在 `identity_mapping` 表创建用户记录
3. 用户无需提前在 Web 端登录绑定

关闭后，未绑定用户 @Bot 会收到提示："请先完成账号绑定后再使用 AI 助手"。

### 10.4 钉钉 / 企业微信（即将支持）

Dashboard 设置页面已预留钉钉和企业微信的配置入口。后端适配器尚在开发中，当前标记为"即将支持"。

---

## 11. 常用运维命令

```bash
# ============= 数据库 =============
cd opencode/packages/platform
bun run db generate        # 根据 schema 生成迁移
bun run db push            # 推送到数据库
bun run db studio          # 打开 Drizzle Studio（数据库 GUI）

# ============= 测试 =============
cd opencode/packages/platform
bun test                   # 运行测试
bun typecheck              # 类型检查

cd opencode/packages/dashboard
bun typecheck              # 前端类型检查
bun run build              # 前端构建

# ============= Docker =============
docker build -f Dockerfile.api -t opencode-platform:latest .
docker build -f packages/platform/worker.Dockerfile -t opencode-worker:latest .
docker compose up -d       # 一键启动全部
docker compose logs -f     # 查看日志
docker compose down        # 停止

# ============= Worker 监控 =============
redis-cli KEYS "worker:*"         # 查看活跃 Worker
redis-cli GET "worker:{userId}"   # 查看某用户 Worker 详情
redis-cli KEYS "circuit:*"        # 查看熔断器状态
redis-cli KEYS "quota:*"          # 查看配额缓存
```

---

## 12. 故障排查

| 现象 | 检查点 |
|------|--------|
| API 启动失败 "DATABASE_URL is required" | 检查 `packages/platform/.env` 是否存在，`DATABASE_URL` 格式是否为 `postgres://user:pass@host:5432/dbname` |
| `db push` 报 "database does not exist" | 需先创建数据库：`docker exec <pg容器名> psql -U <用户名> -d postgres -c "CREATE DATABASE opencode;"` |
| Worker 启动失败 | 检查 Redis 是否可达：`redis-cli ping` 应返回 `PONG`；检查端口是否冲突 |
| Dashboard 打开白屏 | 检查 Platform Server 是否在 3100 端口运行，Vite 代理依赖它 |
| 对话无响应 | 检查 Worker 是否启动：`redis-cli KEYS "worker:*"`；检查 Worker 健康：`curl localhost:{port}/global/health` |
| 飞书登录失败 | 检查 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 是否正确，飞书应用是否已上架 |
| 飞书 Bot 不回复 | 1) 检查 Dashboard 设置中渠道是否启用；2) 测试连接是否通过；3) 确认事件回调 URL 公网可达 |
| Worker 数量过多 | 调整 `MAX_WORKERS` 或 `WORKER_IDLE_MS`；检查是否有僵尸 Worker |
| PostgreSQL 连接过多 | 生产环境务必使用 PgBouncer，配置 `pool_mode = transaction` |
| 配额检查不生效 | 检查 `quota_config` 表是否有数据，Redis 中 `quota:*` key 是否正常递增 |
| 工具调用被拒绝 | 检查 Redis `circuit:*` key，确认熔断器是否处于 OPEN 状态 |
| Docker 构建失败 | 确保在**项目根目录**执行 `docker build`，因为 monorepo 需要完整上下文 |
