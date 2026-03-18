# OpenCode Enterprise Platform - System Design Specification

> **Status**: Approved (Design Phase)
> **Date**: 2026-03-18
> **Scope**: Enterprise-grade AI platform built on OpenCode

## 1. Overview

### 1.1 Goal

Transform OpenCode from a developer CLI tool into an enterprise AI platform supporting 1,000-10,000 users with ~2,000 concurrent sessions. The platform integrates with Feishu (飞书) IM, provides multi-tenant session management, RBAC, MCP tool marketplace, quota/billing, and a web dashboard.

### 1.2 Architecture Pattern

**Modular Monolith + Worker Separation** (Hybrid approach)

- Minimal modifications to OpenCode Core (hook points, event emission)
- Enterprise features in independent packages within the monorepo
- API Server and Worker Pool as separate K8s deployable units
- BullMQ (Redis-backed) for async job processing

### 1.3 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| API Framework | Hono |
| Primary DB | PostgreSQL (Drizzle ORM) |
| Cache/Queue | Redis (ioredis) + BullMQ |
| AI SDK | Vercel AI SDK (streamText) |
| MCP | @modelcontextprotocol/sdk |
| Frontend | Solid.js + Vite + Tailwind CSS |
| Auth | JWT + Feishu OAuth |
| Deployment | Docker + Kubernetes |

### 1.4 System Architecture

```
                                    ┌─────────────────────────┐
                                    │     API Gateway          │
                                    │   (Traefik / Kong)       │
                                    └──────────┬──────────────┘
                                               │
                     ┌─────────────────────────┼─────────────────────────┐
                     │                         │                         │
              ┌──────▼──────┐          ┌───────▼──────┐          ┌──────▼──────┐
              │  Web Server  │          │  WS Server   │          │  IM Adapter  │
              │   (Hono)     │          │  (WebSocket)  │          │  (Feishu)    │
              │  REST API    │          │  Real-time    │          │  Callback    │
              └──────┬───────┘          └──────┬───────┘          └──────┬──────┘
                     │                         │                         │
              ┌──────▼─────────────────────────▼─────────────────────────▼──────┐
              │                    Enterprise Core (Bun)                         │
              │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
              │  │  Auth     │ │ Session  │ │   MCP    │ │ Billing  │           │
              │  │  Module   │ │ Module   │ │ Manager  │ │ Module   │           │
              │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
              │                   ↕ OpenCode Core (Engine)                      │
              └─────────┬────────────────┬────────────────┬─────────────────────┘
                        │                │                │
                 ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
                 │ PostgreSQL   │  │    Redis     │  │   BullMQ   │
                 │ (Primary)    │  │ (Cache/Sub)  │  │  (Queue)   │
                 └─────────────┘  └─────────────┘  └─────┬──────┘
                                                         │
                                                  ┌──────▼──────┐
                                                  │   Workers    │
                                                  │ (AI Inference)│
                                                  └─────────────┘
```

---

## 2. Package Structure

### 2.1 New Packages

```
packages/
├── opencode/                  # [Existing] OpenCode Core - minimal modifications
├── app/                       # [Existing] Solid.js Web App
├── enterprise/                # [New] Enterprise modules
│   ├── core/                  # Bootstrap, module registry, event bus
│   ├── auth/                  # Feishu OAuth, JWT, identity mapping
│   ├── rbac/                  # RBAC, MCP tool-level permissions, row-level isolation
│   ├── session/               # PostgreSQL storage, multi-user sessions
│   ├── mcp-manager/           # Dynamic mounting, visibility, hot-plug
│   ├── billing/               # Quotas, rate limiting, circuit breaker, cost tracking
│   ├── worker/                # BullMQ consumer, AI inference execution
│   ├── im-adapter/            # Feishu callback/push, abstract adapter interface
│   ├── dashboard-api/         # Analytics aggregation, admin endpoints
│   └── server/                # Hono routes, WebSocket, SSE
├── dashboard/                 # [New] Enterprise Web Dashboard (Solid.js)
└── shared/                    # [New] Shared types, utilities
```

### 2.2 OpenCode Core Modifications

Hook points added to OpenCode Core for enterprise integration:

| Hook | Location | Purpose |
|---|---|---|
| `beforePrompt` | `SessionPrompt.loop()` entry | Quota check, permission validation |
| `afterToolResolve` | `LLM.resolveTools()` after | Filter tools by user role |
| `onTokenUsage` | `SessionProcessor` usage event | Real-time token metering to Billing |
| `onToolCall` | Before tool execution | Tool-level permission check |
| `onToolResult` | After tool execution | Audit logging |
| `onMcpToolsChanged` | MCP tool list change event | Trigger hot-plug logic |

Hook interface:

```typescript
export namespace SessionHooks {
  export type BeforePrompt = (ctx: { session: Session.Info; user: string }) => Promise<void | { deny: string }>
  export type AfterToolResolve = (tools: Tool[]) => Promise<Tool[]>
  export type OnTokenUsage = (usage: TokenUsage) => Promise<void>
  export type OnToolCall = (call: ToolCall) => Promise<void | { deny: string }>
  export type OnToolResult = (result: ToolResult) => Promise<void>
}
```

### 2.3 Database Strategy

- **OpenCode SQLite**: Retained for local development mode
- **Enterprise mode**: Activated via `ENTERPRISE_MODE=true`, switches to PostgreSQL
- **Drizzle ORM**: Shared across both databases, only dialect changes (`pg` vs `sqlite`)
- **Redis**: Connected via `ioredis` for session cache, BullMQ queues, rate limiting

---

## 3. Auth & RBAC System

### 3.1 Authentication Flow

**Feishu H5 Embedded Mode (Primary)**:

```
User clicks app in Feishu Workbench
  → Feishu auto-injects code into H5 URL
  → Frontend extracts code → POST /api/v1/auth/feishu/callback
  → Backend exchanges code for feishu access_token + user_info
  → Query identity_mapping table → silent register/login
  → Call Feishu API /contact/v3/users/me → get department, job level
  → Generate JWT (contains internal_id, roles, dept_ids)
  → Return JWT to frontend
  → Frontend stores JWT for subsequent requests
```

**Feishu Bot Mode**:

```
User DMs bot
  → Bot replies with card "Click to authorize"
  → User clicks → OAuth authorization page → callback binds
  → Subsequent messages carry feishu_user_id → map to internal user
```

### 3.2 Identity Mapping Schema

```sql
CREATE TABLE identity_mapping (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_id     UUID NOT NULL UNIQUE,
    employee_id     VARCHAR(64),
    feishu_user_id  VARCHAR(128),
    feishu_union_id VARCHAR(128),
    dingtalk_id     VARCHAR(128),
    wecom_id        VARCHAR(128),
    name            VARCHAR(256) NOT NULL,
    email           VARCHAR(256),
    avatar_url      TEXT,
    department_ids  JSONB NOT NULL DEFAULT '[]',
    job_level       VARCHAR(64),
    status          VARCHAR(32) DEFAULT 'active',
    last_sync_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_feishu ON identity_mapping(feishu_user_id) WHERE feishu_user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_union ON identity_mapping(feishu_union_id) WHERE feishu_union_id IS NOT NULL;
```

### 3.3 JWT Strategy

- **Expiry**: 2 hours (aligned with Feishu ticket validity)
- **Payload**: `{ sub: internal_id, roles: [...], depts: [...], level: "...", iat, exp }`
- **Refresh**: Frontend auto-refreshes when JWT remaining < 30min
- **Org sync**: Each refresh calls Feishu API to check department/level changes, dynamically updates RBAC
- **Multi-device**: Based on `union_id`, Feishu PC/Mobile share login state

### 3.4 RBAC Permission Model

```
Role
  └─ PermissionSet
       ├─ MCP tool permissions: { tool_pattern: "git_*", action: "allow" }
       ├─ MCP server permissions: { mcp_name: "erp", action: "allow" }
       └─ Feature permissions: { feature: "admin_dashboard", action: "allow" }

User
  └─ Role list [roles]
  └─ Department list [departments]
       └─ Departments have default role mappings
```

**Preset Roles**:

| Role | MCP Access | Feature Access |
|---|---|---|
| `developer` | git, jira, ci_cd, code_review | Basic chat |
| `finance` | erp, expense, invoice | Basic chat + approvals |
| `manager` | Inherits subordinate roles + analytics | Dashboard + quota management |
| `admin` | All | All management features |

**Permission Evaluation**:
1. Tool call triggers `onToolCall` hook
2. Extract `roles` + `depts` from JWT
3. Merge user direct roles + department default roles
4. Check tool name against allowed `tool_pattern` entries
5. Match → allow; Hit deny → reject; No match → default deny

### 3.5 Row-Level Data Isolation

During MCP tool execution, enterprise context is automatically injected:

```typescript
const ctx = {
  tenant_id: user.tenant_id,
  dept_ids: user.department_ids,
  user_id: user.internal_id,
}
toolArgs.__enterprise_ctx = ctx
```

MCP Servers are responsible for using `__enterprise_ctx` to filter data queries.

---

## 4. MCP Management System

### 4.1 MCP Registry Schema

```sql
CREATE TABLE mcp_registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL UNIQUE,
    display_name    VARCHAR(256) NOT NULL,
    description     TEXT,
    type            VARCHAR(16) NOT NULL,
    config          JSONB NOT NULL,
    visibility      VARCHAR(16) NOT NULL DEFAULT 'PRIVATE',
    owner_id        UUID NOT NULL REFERENCES identity_mapping(internal_id),
    group_id        UUID,
    tags            JSONB DEFAULT '[]',
    health_status   VARCHAR(16) DEFAULT 'unknown',
    last_health_at  TIMESTAMPTZ,
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mcp_authorization (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mcp_id          UUID NOT NULL REFERENCES mcp_registry(id),
    grantee_type    VARCHAR(16) NOT NULL,
    grantee_id      VARCHAR(128) NOT NULL,
    permission      VARCHAR(16) NOT NULL DEFAULT 'use',
    granted_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mcp_group (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL,
    description     TEXT,
    type            VARCHAR(16) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Visibility Matrix

| Visibility | Who Can See (Market) | Who Can Use (Call Tools) | Who Can Manage |
|---|---|---|---|
| PUBLIC | Everyone | Everyone | Owner + Admin only |
| PRIVATE | Owner only | Owner only | Owner only |
| SHARED | Everyone (shows "needs auth") | Authorized users only | Owner only |

### 4.3 Session-Time MCP Resolution

When a user starts a session, the system dynamically computes available MCPs:

```typescript
function resolve(user: UserContext): McpConfig[] {
  // 1. All PUBLIC MCPs (enabled)
  // 2. User's own PRIVATE MCPs
  // 3. SHARED MCPs where user is authorized (by user_id, role, or department)
  // 4. Deduplicate and return
}
```

### 4.4 Hot-Plug ToolRegistryWatcher

Redis Pub/Sub-based observer pattern for real-time tool updates:

```
Admin changes MCP permissions → Write DB → Publish Redis message
                                              ↓
                                All Worker/API nodes receive
                                              ↓
                            ToolRegistryWatcher detects change
                                              ↓
                ┌─ Re-resolve user's MCP list
                ├─ Compute diff: added/removed tools
                ├─ Update current Agent Loop's Tool Definitions
                └─ Inject silent System Prompt update:
                   "Tool update: You now have [new tools].
                    These tools are no longer available: [removed]"
```

- **Redis Channel**: `mcp:change:{user_id}` — targeted push to affected users
- **Debounce**: 300ms to prevent storms from batch permission changes
- **No history clearing**: System prompt update appends a notification, doesn't interrupt conversation
- **Connection pooling**: Shared MCP client connections across users for the same MCP Server
- **Health checks**: Periodic ping to each MCP Server, updating `health_status`

---

## 5. Enterprise Session Management

### 5.1 Session Schema (PostgreSQL)

```sql
CREATE TABLE enterprise_session (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity_mapping(internal_id),
    project_id      VARCHAR(256),
    title           VARCHAR(512),
    directory       TEXT,
    status          VARCHAR(16) DEFAULT 'active',
    mcp_snapshot    JSONB,
    system_prompt   TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE enterprise_message (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES enterprise_session(id),
    role            VARCHAR(16) NOT NULL,
    content         JSONB NOT NULL,
    tokens_input    INTEGER DEFAULT 0,
    tokens_output   INTEGER DEFAULT 0,
    tokens_cached   INTEGER DEFAULT 0,
    cost_usd        DECIMAL(12,8) DEFAULT 0,
    model_id        VARCHAR(128),
    provider_id     VARCHAR(64),
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE enterprise_tool_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL,
    message_id      UUID NOT NULL,
    tool_name       VARCHAR(256) NOT NULL,
    mcp_name        VARCHAR(128),
    input           JSONB,
    output          JSONB,
    status          VARCHAR(16) NOT NULL,
    duration_ms     INTEGER,
    user_id         UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_user ON enterprise_session(user_id, created_at DESC);
CREATE INDEX idx_message_session ON enterprise_message(session_id, created_at);
CREATE INDEX idx_tool_log_session ON enterprise_tool_log(session_id, created_at);
CREATE INDEX idx_tool_log_user ON enterprise_tool_log(user_id, created_at);
```

### 5.2 Session Loading Strategy (Redis Cache)

```
User sends message → Check Redis session:{session_id}
  ├─ Hit → Use cached message history
  └─ Miss → Load from PostgreSQL → Write to Redis (TTL: 30min)
→ Pass to LLM
→ Sync-write new message to PostgreSQL + Update Redis cache
```

**Long context optimization**:
- Sliding window + summary strategy when exceeding token window
- Keep latest N messages full + auto-summarize earlier messages
- Summary generated by LLM and cached in `enterprise_session.metadata.summary`

---

## 6. Quota & Billing System

### 6.1 Quota Schema

```sql
CREATE TABLE quota_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type      VARCHAR(16) NOT NULL,
    scope_id        VARCHAR(128) NOT NULL,
    period          VARCHAR(16) NOT NULL,
    max_tokens      BIGINT NOT NULL,
    max_requests    INTEGER,
    max_cost_usd    DECIMAL(12,4),
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quota_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type      VARCHAR(16) NOT NULL,
    scope_id        VARCHAR(128) NOT NULL,
    period_key      VARCHAR(16) NOT NULL,
    tokens_used     BIGINT DEFAULT 0,
    requests_count  INTEGER DEFAULT 0,
    cost_usd        DECIMAL(12,4) DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(scope_type, scope_id, period_key)
);
```

### 6.2 Multi-Level Quota Check (in `beforePrompt` hook)

```
1. Check user daily quota → exceed → deny
2. Check user monthly quota → exceed → deny
3. Check department monthly quota → exceed → deny ("Department budget exhausted")
4. Check global quota → exceed → deny (prevent cascade)
5. All pass → allow

Quota counts use Redis INCRBY for real-time accumulation,
periodically synced to PostgreSQL.
Redis Key: quota:{scope}:{scope_id}:{period_key}:tokens
```

### 6.3 Rate Limiting

Sliding window algorithm based on Redis:

| Dimension | Default | Configurable |
|---|---|---|
| Per-user RPM | 20 | By role |
| Per-user concurrency | 3 | By role |
| Per-department RPM | 200 | By department |
| Global RPM | 2000 | Admin config |

Implementation: Redis `ZRANGEBYSCORE` sliding window, `SCARD` for active concurrency tracking.

### 6.4 Circuit Breaker

Per-MCP-Server monitoring:

```
CLOSED (normal) → error rate > 10% in 1 min → OPEN (tripped)
OPEN → 30s cooldown → HALF_OPEN (probe)
HALF_OPEN → 3 consecutive successes → CLOSED
HALF_OPEN → 1 failure → OPEN (re-trip)
```

User-facing: When MCP is OPEN, tool calls return friendly message:
> "The finance system is currently busy (response timeout). Please try again later."

State stored in Redis: `circuit:{mcp_name}` = `{ state, failures, lastFailAt, lastSuccessAt }`

### 6.5 Cost Tracking & Audit

After each LLM call completes, the `onTokenUsage` hook records:

```typescript
audit_log = {
  user_id, session_id, model_id, provider_id,
  tokens: { input, output, cached, reasoning },
  cost_usd: calculated_cost,
  tools_called: [{ name, mcp, duration_ms, status }],
  timestamp
}
```

---

## 7. IM Integration Layer

### 7.1 Async Handshake + Push Architecture

```
Feishu Callback / Web Request
      │
      ▼
 ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
 │  API Server  │────▶│   BullMQ     │────▶│   Worker Pool  │
 │  (Hono)      │     │   Queue      │     │   (N procs)    │
 │              │     │              │     │               │
 │ 1. Verify    │     │ job = {      │     │ 1. Load Session│
 │ 2. Enqueue   │     │   user_id,   │     │ 2. Run Agent   │
 │ 3. Return 200│     │   message,   │     │ 3. Call MCPs   │
 └─────────────┘     │   session_id,│     │ 4. Gen Result  │
                      │   source,    │     └───────┬───────┘
                      │   callback   │             │
                      │ }            │             ▼
                      └──────────────┘     ┌───────────────┐
                                           │  Result Push   │
                                           │               │
                                           │ source=feishu  │
                                           │  → Feishu API  │
                                           │ source=web     │
                                           │  → WebSocket   │
                                           └───────────────┘
```

### 7.2 IM Adapter Interface

```typescript
interface ImAdapter {
  verify(req: Request): Promise<boolean>
  parse(body: unknown): Promise<ImMessage>
  reply(target: string, content: ImReply): Promise<void>
  card(target: string, card: ImCard): Promise<void>
}

type ImMessage = {
  source: "feishu" | "dingtalk" | "wecom" | "web"
  user_external_id: string
  chat_id: string
  chat_type: "private" | "group"
  content: string
  mentions?: string[]
  metadata: Record<string, unknown>
}
```

### 7.3 Feishu Response Strategy

| Scenario | Handling |
|---|---|
| Simple query (< 5s) | Worker completes → reply text via Feishu API |
| Complex query (> 5s) | Reply "Received, processing..." → push result when done |
| Tool calls needed | Reply card "Task in progress, click for details" → link to H5 |
| Streaming needed | Reply card, guide user to H5 for real-time stream |
| Approval needed | Reply approval card with "Approve"/"Reject" buttons |

---

## 8. API Server & WebSocket

### 8.1 API Routes

```
/api/v1/auth/
  POST /feishu/callback     # Feishu OAuth callback
  POST /refresh             # JWT refresh
  GET  /me                  # Current user info

/api/v1/chat/
  POST /                    # Send message → enqueue
  GET  /sessions            # Session list
  GET  /sessions/:id        # Session detail + message history
  DELETE /sessions/:id      # Delete session

/api/v1/mcp/
  GET  /market              # MCP market (by visibility)
  POST /                    # Register MCP
  PUT  /:id                 # Update MCP
  POST /:id/authorize       # Authorize user/role/department
  GET  /:id/health          # Health status

/api/v1/admin/
  GET  /users               # User list
  PUT  /users/:id/roles     # Modify roles
  GET  /quotas              # Quota configs
  PUT  /quotas/:id          # Modify quota
  GET  /dashboard           # Dashboard data

/api/v1/im/
  POST /feishu/webhook      # Feishu event callback

/ws                         # WebSocket (real-time push)
/sse                        # SSE (fallback)
```

### 8.2 WebSocket Protocol

```typescript
// Client → Server
type WsClientMsg =
  | { type: "chat"; session_id: string; message: string }
  | { type: "cancel"; session_id: string }
  | { type: "ping" }

// Server → Client
type WsServerMsg =
  | { type: "text_delta"; session_id: string; content: string }
  | { type: "tool_call"; session_id: string; tool: string; mcp: string; status: "start" | "done" | "error"; input?: unknown; output?: unknown; duration_ms?: number }
  | { type: "reasoning"; session_id: string; content: string }
  | { type: "done"; session_id: string; usage: TokenUsage }
  | { type: "error"; session_id: string; code: string; message: string }
  | { type: "mcp_change"; added: string[]; removed: string[] }
  | { type: "quota_warning"; remaining_pct: number; message: string }
  | { type: "pong" }
```

---

## 9. Frontend Dashboard

### 9.1 Design System

| Dimension | Choice |
|---|---|
| Style | Data-Dense Dashboard |
| Colors | Primary `#2563EB` / CTA `#F97316` / BG `#F8FAFC` / Text `#1E293B` |
| Dark Mode | BG `#0a0a0c` / Elevated `#121212` / Accent `#5E6AD2` |
| Typography | Plus Jakarta Sans (400/600/700) |
| Icons | Lucide Icons (SVG, consistent stroke width) |
| Border Radius | 8px (cards) / 6px (buttons/inputs) |
| Spacing | 4px base unit, 8px increments (16/24/32/48 steps) |

### 9.2 Page Structure

```
┌──────────────────────────────────────────────┐
│  Top Bar: Logo  Search  Notifications  User  │
├───────────┬──────────────────────────────────┤
│  Sidebar  │        Main Content Area         │
│           │                                  │
│  Chat     │  (Route-based switching)         │
│  MCP      │                                  │
│  Dashboard│                                  │
│  Users    │                                  │
│  Config   │                                  │
│  Audit    │                                  │
├───────────┴──────────────────────────────────┤
│  Status: Connection  Quota  Version          │
└──────────────────────────────────────────────┘
```

### 9.3 Core Pages

1. **Chat Page**: Session list (left) + Conversation area (right) with streaming text, tool call cards, approval cards, markdown rendering
2. **MCP Market**: Card grid with visibility filters, health badges, tool counts, usage stats
3. **Dashboard**: KPI cards (Total Tokens, Cost, Active Users, Avg Response Time) + trend charts + department rankings + top MCP tools table
4. **Admin Pages**: User management, quota tree view, audit timeline, system configuration

### 9.4 Tech Stack

| Technology | Purpose |
|---|---|
| Solid.js + Solid Router | Framework (consistent with OpenCode) |
| Vite | Build tool |
| Tailwind CSS | Styling |
| Apache ECharts | Charts (data-dense scenarios) |
| Native WebSocket | Real-time communication |
| marked + highlight.js | Markdown rendering |
| @tanstack/solid-table | Virtual scrolling tables |
| @modular-forms/solid | Type-safe forms |

### 9.5 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| < 768px (Mobile/H5) | Hidden sidebar, bottom nav, full-screen chat |
| 768-1024px (Tablet) | Collapsible sidebar, two-column |
| > 1024px (Desktop) | Full three-column layout |

H5 embedded mode: Auto-detect Feishu UA, hide top bar, adjust safe areas.

---

## 10. Sub-Project Decomposition & Build Order

| Priority | Sub-Project | Description | Dependencies |
|---|---|---|---|
| P0 | Auth & RBAC | Feishu OAuth, JWT, identity mapping, roles | None |
| P0 | Core Backend | Enterprise server, PostgreSQL session, Redis, hooks | Auth |
| P1 | MCP Manager | Dynamic mounting, visibility, hot-plug, health | Auth + Backend |
| P1 | Billing | Quotas, rate limiting, circuit breaker, cost tracking | Auth + Backend |
| P2 | IM Adapter | Feishu callback/push, async handshake, BullMQ workers | Backend + Auth |
| P2 | Frontend Dashboard | Solid.js dashboard with all management pages | All backend modules |

Each sub-project follows its own **spec → plan → implementation** cycle.

---

## 11. Deployment

### 11.1 K8s Components

```yaml
# API Server (stateless, horizontally scalable)
- Deployment: enterprise-api (2-8 replicas, HPA on CPU)
- Service: ClusterIP → Ingress

# Worker Pool (stateless, horizontally scalable)
- Deployment: enterprise-worker (4-16 replicas, HPA on queue depth)

# WebSocket Server (sticky sessions)
- Deployment: enterprise-ws (2-4 replicas)
- Service: ClusterIP → Ingress (WebSocket upgrade)

# Infrastructure
- PostgreSQL: Managed service or StatefulSet
- Redis: Managed service or StatefulSet (Sentinel)
```

### 11.2 Environment Variables

```
ENTERPRISE_MODE=true
DATABASE_URL=postgres://...
REDIS_URL=redis://...
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
JWT_SECRET=xxx
OPENCODE_SERVER_PASSWORD=xxx (optional basic auth)
```
