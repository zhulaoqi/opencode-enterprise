<h1 align="center">OpenCode Enterprise</h1>

<p align="center">
  低成本的企业级智能生态驱动器<br/>
  基于 <a href="https://github.com/anomalyco/opencode">OpenCode</a> 的 CLI Agent + MCP 编排能力构建
</p>

<p align="center">
  <img alt="Bun" src="https://img.shields.io/badge/runtime-Bun_1.1+-f472b6?style=flat-square&logo=bun" />
  <img alt="TypeScript" src="https://img.shields.io/badge/lang-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Solid.js" src="https://img.shields.io/badge/frontend-Solid.js-2c4f7c?style=flat-square&logo=solid&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/db-PostgreSQL_16-4169e1?style=flat-square&logo=postgresql&logoColor=white" />
  <img alt="Redis" src="https://img.shields.io/badge/cache-Redis_7-dc382d?style=flat-square&logo=redis&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
</p>

> **声明**：本项目基于 [OpenCode](https://github.com/anomalyco/opencode) 二次开发，非 OpenCode 官方团队出品，与其无隶属关系。

---

## 为什么做这个项目

OpenCode 是一个被低估的开源项目。大多数人把它当作"又一个 AI 编程工具"，但我们看到的是：

| 能力 | 价值 |
|------|------|
| **CLI Agent 架构** | 不依赖 IDE 插件，任何终端环境都能跑，部署灵活 |
| **MCP 协议原生支持** | 标准化的工具调用协议，一次接入、处处可用 |
| **极低的 Token 消耗** | 精简的 prompt 工程 + 高效的上下文管理，同等任务比同类产品省 60%+ tokens |
| **SessionHook 扩展点** | 6 个细粒度 Hook，零侵入注入企业逻辑 |

把这些能力组合起来，再加上企业级的管控层（配额、审计、权限），就得到一个**极低成本运行的企业智能生态驱动器**：

- 不是 AI 中台 —— 没有那么重，不做模型训练、不做数据标注
- 不是编程平台 —— AI 只是引擎，MCP 工具才是核心交付物
- 是什么 —— **用最低的 Token 成本，通过 MCP 协议把 AI 能力接入企业的任何业务系统**

```
你的 CRM 系统 ←── MCP ──┐
你的运维平台 ←── MCP ──┤
你的数据仓库 ←── MCP ──┼── OpenCode Agent ←── 自然语言指令
你的文档系统 ←── MCP ──┤
你的内部 API ←── MCP ──┘
```

一个人对着对话框说一句话，AI Agent 通过 MCP 自动调用正确的工具，完成跨系统的业务操作。成本？可能就几分钱的 Token。

---

## 目录

- [功能演示](#功能演示)
- [系统架构](#系统架构)
- [核心设计](#核心设计)
  - [为什么选 OpenCode 做引擎](#为什么选-opencode-做引擎)
  - [MCP 生态治理](#mcp-生态治理)
  - [成本控制体系](#成本控制体系)
  - [SessionHook 扩展机制](#sessionhook-扩展机制)
  - [实时通信架构](#实时通信架构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [API 概览](#api-概览)
- [License](#license)

---

## 功能演示

### AI 对话 — 自然语言驱动 MCP 工具

<p align="center">
  <img src="docs/assets/screenshot-chat.png" width="800" alt="AI 对话界面" />
</p>

- 多会话管理，流式输出
- 模型按需切换（默认 + 自定义分组）
- AI 自动识别意图并通过 MCP 调用对应工具

### 模型管理 — 集中管控，用户无感

<p align="center">
  <img src="docs/assets/screenshot-models.png" width="800" alt="模型管理" />
</p>

- 管理员统一配置 API Key 和模型端点
- 支持 OpenAI / OpenRouter / Azure / 自定义兼容协议
- 拖拽排序，一键启停

### 审计日志 — 全链路可追溯

<p align="center">
  <img src="docs/assets/screenshot-audit.png" width="800" alt="审计日志" />
</p>

- 每次对话：谁、用了什么模型、调了哪些工具、花了多少 Token、成本多少
- 按用户 / 操作 / 时间筛选，支持 CSV 导出

### 仪表盘 — 企业用量全景

<p align="center">
  <img src="docs/assets/screenshot-dashboard.png" width="800" alt="仪表盘" />
</p>

- KPI 概览、Token 趋势、活跃用户 Top 10、MCP 使用排行、模型分布

---

## 系统架构

### 整体分层

```mermaid
graph TB
    subgraph Clients["🖥️ 接入层"]
        style Clients fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0c4a6e
        Web["Web Dashboard<br/>(Solid.js)"]
        Feishu["飞书 Bot<br/>(Webhook)"]
        CLI["OpenCode TUI<br/>(Terminal)"]
    end

    subgraph Gateway["⚡ API 网关 (Hono on Bun)"]
        style Gateway fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
        Auth["Auth<br/>JWT + 飞书 OAuth"]
        Session["Session<br/>会话管理"]
        MCP["MCP Registry<br/>工具注册 + 授权"]
        Billing["Billing<br/>配额 + 审计"]
        Dash["Dashboard<br/>数据分析"]
        Model["Model<br/>多模型配置"]
    end

    subgraph Hooks["🔗 SessionHook Layer"]
        style Hooks fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#831843
        H1["beforePrompt<br/>配额 + 限流"]
        H2["afterToolResolve<br/>MCP 工具过滤"]
        H3["onToolCall<br/>熔断器检查"]
        H4["onToolResult<br/>审计写入"]
        H5["onTokenUsage<br/>成本计算"]
        H6["onMcpToolsChanged<br/>变更推送"]
    end

    subgraph Worker["🏭 Worker 层 (BullMQ)"]
        style Worker fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d
        Queue["Redis Queue<br/>任务分发"]
        Agent["AI Agent<br/>OpenCode Core"]
        Stream["Stream Processor<br/>流式输出"]
    end

    subgraph Data["💾 数据层"]
        style Data fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#3b0764
        PG["PostgreSQL 16<br/>业务数据 + 审计日志"]
        Redis["Redis 7<br/>队列 + 限流 + 熔断 + Pub/Sub"]
    end

    Web & Feishu & CLI -->|HTTP / WS| Gateway
    Gateway --> Hooks
    Hooks --> Worker
    Queue --> Agent --> Stream
    Worker --> Data
    Gateway --> Data
```

### 请求生命周期

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant WS as WebSocket
    participant Queue as BullMQ
    participant Hook as SessionHook
    participant Agent as AI Agent
    participant MCP as MCP Tool
    participant DB as PostgreSQL

    User->>WS: 发送消息 (chat)
    WS->>WS: JWT 验证
    WS->>Queue: 入队 (enqueue)
    WS-->>User: ack ✅

    Queue->>Hook: beforePrompt
    Note over Hook: 配额检查<br/>滑窗限流

    Hook->>Hook: afterToolResolve
    Note over Hook: 按用户授权<br/>过滤可用 MCP 工具

    Hook->>Agent: 执行 AI 推理

    loop 工具调用
        Agent->>Hook: onToolCall
        Note over Hook: 熔断器检查
        Hook->>MCP: 调用 MCP 工具
        MCP-->>Hook: 工具返回
        Hook->>DB: onToolResult → 审计日志
    end

    Agent-->>WS: text_delta (流式)
    Agent->>Hook: onTokenUsage
    Note over Hook: 配额递增<br/>成本计算
    Hook->>DB: 写入审计记录

    WS-->>User: done ✅ {text, tokens, cost}
```

---

## 核心设计

### 为什么选 OpenCode 做引擎

```mermaid
mindmap
  root((OpenCode<br/>核心优势))
    🔧 CLI Agent
      不依赖 IDE
      任何终端可运行
      容器化部署友好
    🔌 MCP 原生支持
      stdio / HTTP / SSE
      标准协议可互操作
      工具热插拔
    💰 Token 极省
      精简 prompt 工程
      增量上下文管理
      比同类省 60%+
    🪝 SessionHook
      6 个扩展点
      零侵入式注入
      Core 可独立升级
```

**Token 成本对比（同等任务）**：

| 场景 | 典型 AI 产品 | OpenCode Agent | 节省比例 |
|------|-------------|----------------|---------|
| 单轮问答 | ~800 tokens | ~300 tokens | **62%** |
| 多工具编排 | ~4000 tokens | ~1500 tokens | **63%** |
| 长对话 (10 轮) | ~12000 tokens | ~5000 tokens | **58%** |

OpenCode 的 Agent 架构在 prompt 层面做了大量优化：只传递必要的上下文，工具描述按需加载，历史消息智能裁剪。这意味着同等质量的 AI 输出，成本可以低到竞品的 1/3。

对企业来说，100 个人日常使用，月成本可能只有几百块，而不是几万块。

### MCP 生态治理

```mermaid
graph LR
    subgraph Visibility["可见性模型"]
        style Visibility fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a5f
        PUBLIC["🌍 PUBLIC<br/>全员自动可用"]
        SHARED["🔗 SHARED<br/>申请 / 邀请制"]
        PRIVATE["🔒 PRIVATE<br/>仅创建者"]
    end

    subgraph Members["成员角色"]
        style Members fill:#fef9c3,stroke:#ca8a04,stroke-width:2px,color:#713f12
        Owner["👑 Owner<br/>创建者，完全控制"]
        Admin["🛡️ Admin<br/>受邀管理，可授权他人"]
        UserRole["👤 User<br/>使用者，可调用工具"]
    end

    subgraph Flow["授权流程"]
        style Flow fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d
        Register["注册 MCP"] --> SetVis["设置可见性"]
        SetVis --> PUBLIC
        SetVis --> SHARED
        SetVis --> PRIVATE
        SHARED --> Apply["用户申请"]
        SHARED --> Invite["管理员邀请"]
        Apply --> Approve["审批通过"]
        Invite --> Approve
        Approve --> UserRole
    end
```

**设计要点**：
- MCP 授权与系统 RBAC **完全解耦**——不依赖角色、部门，只看 MCP 自身的成员列表
- PUBLIC 类型 MCP 自动对所有人可用，零配置
- SHARED 类型支持**双向**：用户主动申请 + 管理员主动邀请
- 每个 MCP 有独立的健康检查，异常时自动熔断保护

### 成本控制体系

```mermaid
graph TB
    subgraph Check["🛡️ 请求前检查 (beforePrompt)"]
        style Check fill:#fef2f2,stroke:#dc2626,stroke-width:2px,color:#7f1d1d
        RL["滑窗限流<br/>Redis ZRANGEBYSCORE<br/>窗口内请求数 > N → 429"]
        UQ["用户配额<br/>tokens_used > max → 429"]
        GQ["全局配额<br/>总量 > limit → 429"]
        CL["成本上限<br/>cost_usd > max → 429"]
        RL --> UQ --> GQ --> CL
    end

    subgraph Execute["✅ 执行"]
        style Execute fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d
        AI["AI Agent 推理"]
        Tool["MCP 工具调用"]
        AI --> Tool
    end

    subgraph Track["📊 请求后追踪 (onTokenUsage)"]
        style Track fill:#eff6ff,stroke:#2563eb,stroke-width:2px,color:#1e3a5f
        Calc["成本计算<br/>(input × price_in + output × price_out) / 1M"]
        Inc["配额递增<br/>quota_usage UPSERT"]
        Audit["审计写入<br/>用户 · 模型 · 工具 · Token · 成本"]
        Calc --> Inc --> Audit
    end

    subgraph Breaker["⚡ 工具级熔断 (per-MCP)"]
        style Breaker fill:#fefce8,stroke:#ca8a04,stroke-width:2px,color:#713f12
        Closed["CLOSED<br/>正常通过"]
        Open["OPEN<br/>连续失败 → 直接拒绝"]
        Half["HALF_OPEN<br/>冷却后试探一次"]
        Closed -->|"连续 N 次失败"| Open
        Open -->|"冷却期结束"| Half
        Half -->|"成功"| Closed
        Half -->|"失败"| Open
    end

    Check -->|PASS| Execute
    Execute --> Track
    Tool --> Breaker
```

**成本可控的关键**：
- **Token 计量分离**：input / output / cached 分别统计，按模型定价精确计费
- **多级配额**：用户级 + 全局级，按日 / 按月周期自动轮转
- **熔断保护**：某个 MCP 故障时快速失败，避免 AI 反复重试浪费 Token
- **审计闭环**：每一分钱花在哪里，清清楚楚

### SessionHook 扩展机制

```mermaid
graph LR
    subgraph Core["OpenCode Core"]
        style Core fill:#f8fafc,stroke:#64748b,stroke-width:2px,color:#1e293b
        Engine["AI Agent<br/>引擎"]
    end

    subgraph Hooks["SessionHook 接口"]
        style Hooks fill:#fce7f3,stroke:#ec4899,stroke-width:2px,color:#831843
        BP["beforePrompt"]
        ATR["afterToolResolve"]
        OTC["onToolCall"]
        OTR["onToolResult"]
        OTU["onTokenUsage"]
        OMTC["onMcpToolsChanged"]
    end

    subgraph Platform["Enterprise Platform"]
        style Platform fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
        Quota["配额检查 + 限流"]
        Filter["MCP 授权过滤"]
        CB["熔断器检查"]
        AuditLog["审计日志"]
        Cost["成本计算 + 配额递增"]
        Notify["WS 推送变更"]
    end

    Engine --> BP --> Quota
    Engine --> ATR --> Filter
    Engine --> OTC --> CB
    Engine --> OTR --> AuditLog
    Engine --> OTU --> Cost
    Engine --> OMTC --> Notify
```

**核心优势**：OpenCode Core 可独立升级，企业层通过 Hook 注入，**不修改上游任何一行代码**。

### 实时通信架构

```mermaid
stateDiagram-v2
    [*] --> Connecting: connect(JWT)
    Connecting --> Connected: 验证通过
    Connecting --> Backoff: 验证失败

    Connected --> Streaming: subscribe + chat
    Streaming --> Connected: done / error
    Connected --> Disconnected: 网络断开

    Disconnected --> Backoff: 自动重连
    Backoff --> Connecting: 指数退避 + 抖动
    note right of Backoff
        1s → 2s → 4s → 8s → ... → 30s (cap)
        + 随机抖动避免雷群效应
        + 离线消息缓冲
        + 页面可见性感知
        + 网络状态感知
    end note

    Connected --> [*]: 用户关闭
```

**生产级保障**：
- 心跳探活（30s ping，60s 无响应断开）
- 服务端 Sweeper 定期清理僵尸连接
- 每用户最多 10 个并发连接
- Safe Send 防止向已关闭 socket 写入

---

## 技术栈

```mermaid
graph LR
    subgraph Runtime["⚡ 运行时"]
        style Runtime fill:#fce7f3,stroke:#ec4899,stroke-width:2px,color:#831843
        Bun["Bun 1.1+<br/>原生 TS, 4x faster"]
    end

    subgraph Backend["🔧 后端"]
        style Backend fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
        Hono["Hono<br/>轻量 API"]
        BullMQ["BullMQ<br/>任务队列"]
        Drizzle["Drizzle ORM<br/>类型安全 SQL"]
        AISDK["Vercel AI SDK<br/>多模型抽象"]
    end

    subgraph Frontend["🎨 前端"]
        style Frontend fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d
        Solid["Solid.js<br/>细粒度响应式"]
        Vite["Vite<br/>极速构建"]
        TW["Tailwind CSS 4<br/>原子化样式"]
    end

    subgraph Infra["💾 基础设施"]
        style Infra fill:#fef9c3,stroke:#ca8a04,stroke-width:2px,color:#713f12
        PG["PostgreSQL 16<br/>JSONB + 事务"]
        Redis["Redis 7<br/>队列 / 限流 / 熔断 / Pub/Sub"]
    end

    Bun --> Hono & BullMQ & Drizzle
    Hono --> AISDK
    Bun --> Solid & Vite
    Hono & BullMQ & Drizzle --> PG & Redis
```

| 选型 | 理由 |
|------|------|
| **Bun** | 原生 TypeScript 运行时，启动快、内存省，适合 Worker 密集场景 |
| **Hono** | 零依赖 Web 框架，兼容 Web Standard API，路由性能极高 |
| **Solid.js** | 无虚拟 DOM，编译期优化，同等 UI 复杂度下 bundle 更小 |
| **Drizzle** | 类型安全的 SQL builder，不做过度抽象，保留 SQL 可控性 |
| **BullMQ** | Redis 驱动的任务队列，成熟稳定，支持优先级和并发限制 |
| **PostgreSQL** | JSONB 支持审计日志中工具调用链的复杂查询 |
| **Redis** | 一个实例承担队列 + 限流 + 熔断 + Pub/Sub，运维成本最低 |

---

## 快速开始

请参阅 **[部署指南](docs/deployment.md)**，包含：

- 前置环境要求（Bun / PostgreSQL / Redis）
- Docker 一键启动基础设施
- 环境变量完整说明（含飞书配置来源）
- 数据库初始化步骤
- 本地开发三终端启动
- Docker 镜像构建 & Compose 编排
- Kubernetes 生产部署 + HPA 自动扩容
- 故障排查手册

---

## 项目结构

```
opencode/
├── packages/
│   ├── opencode/                # OpenCode Core — AI Agent 引擎
│   │
│   ├── platform/                # 企业管控层
│   │   └── src/
│   │       ├── auth/            # 飞书 OAuth + JWT + 身份映射
│   │       ├── rbac/            # 角色权限
│   │       ├── billing/         # 配额 + 审计 + 仪表盘
│   │       ├── mcp-manager/     # MCP 注册表 + 成员 + 健康检查
│   │       ├── model/           # 多模型配置
│   │       ├── session/         # 会话 + 消息
│   │       ├── hooks/           # 6 个 SessionHook 实现
│   │       ├── server/          # Hono 路由 + WebSocket
│   │       ├── worker/          # BullMQ 消费者 + AI Agent
│   │       └── im/              # 飞书 IM 适配器
│   │
│   └── dashboard/               # Web 前端
│       └── src/
│           ├── pages/           # Chat / Dashboard / MCP / Models / Users / Quotas / Audit
│           ├── components/      # UI 组件库
│           ├── stores/          # 状态管理
│           └── lib/             # WebSocket / API / 工具函数
│
└── docs/
    ├── deployment.md            # 部署指南
    └── assets/                  # 截图素材
```

---

## API 概览

```
GET  /health                              健康检查

POST /api/auth/feishu/callback            飞书 OAuth 回调
POST /api/auth/refresh                    JWT 刷新
GET  /api/auth/me                         当前用户

GET  /api/sessions                        会话列表
POST /api/sessions                        创建会话
GET  /api/sessions/:id                    消息历史
DELETE /api/sessions/:id                  删除会话

GET  /api/mcp/market                      MCP 市场
POST /api/mcp                             注册 MCP
PUT  /api/mcp/:id                         更新 MCP
GET  /api/mcp/:id                         详情 + 成员
POST /api/mcp/:id/authorize               添加成员
DELETE /api/mcp/:id/authorize             移除成员

GET  /api/models                          可用模型
POST /api/models/admin                    新增模型
PUT  /api/models/admin/reorder            排序
PUT  /api/models/admin/:id                编辑
DELETE /api/models/admin/:id              删除

GET  /api/admin/users                     用户管理
PUT  /api/admin/users/:id/roles           修改角色

GET  /api/billing/quotas-with-usage       配额列表
POST /api/billing/quotas                  创建配额

GET  /api/dashboard/overview              KPI 概览
GET  /api/dashboard/trend                 Token 趋势
GET  /api/dashboard/active-users          活跃用户排行
GET  /api/dashboard/mcp-leaderboard       MCP 使用排行
GET  /api/dashboard/model-distribution    模型分布
GET  /api/dashboard/top-tools             热门工具

WS   /ws?token=JWT                        实时通信
```

完整的 WebSocket 协议、Hook 系统、API 字段说明详见 **[部署指南](docs/deployment.md)**。

---

## 与 OpenCode 的关系

```mermaid
graph TB
    subgraph Upstream["OpenCode (上游)"]
        style Upstream fill:#f8fafc,stroke:#94a3b8,stroke-width:2px,color:#334155
        TUI["Terminal TUI"]
        AgentCore["AI Agent Core"]
        HookDef["SessionHook 接口定义"]
        MCPClient["MCP Client"]
    end

    subgraph Enterprise["本项目 (企业层)"]
        style Enterprise fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e40af
        WebUI["Web Dashboard"]
        FeishuBot["飞书 Bot"]
        HookImpl["SessionHook 实现<br/>(配额/审计/限流/熔断)"]
        MCPGov["MCP 治理<br/>(注册/授权/健康)"]
        Multi["多模型管理"]
        Analytics["数据分析"]
    end

    AgentCore -->|"零修改复用"| HookImpl
    HookDef -->|"接口注入"| HookImpl
    MCPClient -->|"协议复用"| MCPGov

    style TUI fill:#e2e8f0,stroke:#94a3b8,color:#475569
```

- 本项目**不修改** OpenCode Core 的任何代码
- 通过 SessionHook 接口零侵入注入企业特性
- 上游更新时，只需升级 `packages/opencode`

---

## License

MIT
