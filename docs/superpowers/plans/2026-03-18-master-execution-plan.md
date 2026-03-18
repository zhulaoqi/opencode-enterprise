# Master Execution Plan — OpenCode Enterprise Platform

> **Total: 63 Tasks · 23 Chunks · 5 Sub-Projects · ~160 Files**
>
> This is the single source of truth for execution order. Every step references its detailed plan.

---

## Overview

```
Phase 0 ─ Auth/RBAC/Core ──── 25 tasks ── packages/enterprise (foundation)
Phase 1a ─ MCP Management ──── 8 tasks ── packages/enterprise/mcp-manager
Phase 1b ─ Billing/Quota ───── 9 tasks ── packages/enterprise/billing
Phase 2a ─ IM Integration ──── 9 tasks ── packages/enterprise/im-adapter + worker
Phase 2b ─ Frontend ────────── 12 tasks ── packages/dashboard
                                ───────
                                63 tasks
```

**Dependencies:**
```
P0 ──┬──→ P1a ──┐
     │          ├──→ P2a ──┐
     └──→ P1b ──┘         ├──→ P2b
                  P1a+P1b ──┘
```

---

## Phase 0: Auth & RBAC + Core Backend

> **Plan:** `plans/2026-03-18-p0-auth-rbac-core-backend.md`
> **Package:** `packages/enterprise/`

### Chunk 0.1 — Project Scaffold & Database

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 1 | Create enterprise `package.json` + `tsconfig.json` | `packages/enterprise/package.json`, `tsconfig.json` | `bun install` succeeds |
| 2 | Environment config (zod validation) | `src/env.ts` | Import check |
| 3 | PostgreSQL connection (Drizzle ORM) | `src/db/index.ts`, `drizzle.config.ts`, `src/db/schema.ts` | — |
| 4 | Redis connection (ioredis) | `src/redis/index.ts` | — |

**Commit after Chunk 0.1**

---

### Chunk 0.2 — Authentication System

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 5 | Identity mapping schema | `src/auth/identity.sql.ts` → migration | `bun run db generate` |
| 6 | JWT sign/verify/refresh (TDD) | `src/auth/jwt.ts` + `test/auth/jwt.test.ts` | 3 tests pass |
| 7 | Feishu OAuth client | `src/auth/feishu.ts` | — |
| 8 | Identity CRUD | `src/auth/identity.ts` | — |
| 9 | Auth middleware (Hono) | `src/auth/middleware.ts` | — |

**Commit after Chunk 0.2**

---

### Chunk 0.3 — RBAC System

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 10 | Role/user_role/department_role schema | `src/rbac/role.sql.ts` → migration | `bun run db generate` |
| 11 | Permission evaluation engine (TDD) | `src/rbac/permission.ts` + `test/rbac/permission.test.ts` | 6 tests pass |
| 12 | Role CRUD + seed data | `src/rbac/role.ts` | — |

**Commit after Chunk 0.3**

---

### Chunk 0.4 — Enterprise Session & Tool Logging

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 13 | Session/message/tool-log schemas | `src/session/session.sql.ts`, `message.sql.ts`, `tool-log.sql.ts` → migration | `bun run db generate` |
| 14 | Session cache (Redis) | `src/session/cache.ts` | — |
| 15 | Enterprise session manager | `src/session/index.ts` | — |

**Commit after Chunk 0.4**

---

### Chunk 0.5 — OpenCode Core Hook System

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 16 | Define SessionHooks interface | `packages/opencode/src/session/hooks.ts` (NEW) | — |
| 17 | Wire beforePrompt hook in `prompt.ts` | `packages/opencode/src/session/prompt.ts` (MODIFY) | — |
| 18 | Wire afterToolResolve, onTokenUsage, onToolCall, onToolResult | `packages/opencode/src/session/llm.ts` + `processor.ts` (MODIFY) | — |

**Commit after Chunk 0.5** — `cd packages/opencode && bun typecheck`

---

### Chunk 0.6 — Enterprise API Server

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 19 | Auth routes (feishu callback, refresh, me) | `src/server/routes/auth.ts` | — |
| 20 | Session CRUD routes | `src/server/routes/session.ts` | — |
| 21 | Health + Admin stub routes | `src/server/routes/health.ts`, `admin.ts` | — |
| 22 | Enterprise Hono server + bootstrap | `src/server/index.ts`, `src/index.ts` | — |
| 23 | Shared types | `src/types.ts` | — |
| 24 | Hook implementations (stubs) | `src/hooks/index.ts`, `before-prompt.ts`, `after-tool-resolve.ts`, `on-tool-call.ts`, `on-token-usage.ts` | — |
| 25 | **P0 Final: typecheck + test** | — | `bun typecheck && bun test` (both packages) |

**Tag: `P0-complete`**

---

## Phase 1a: MCP Management System

> **Plan:** `plans/2026-03-18-p1a-mcp-management.md`
> **Package:** `packages/enterprise/src/mcp-manager/`

### Chunk 1a.1 — MCP Registry & Database

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 26 | MCP registry + authorization + group schemas | `mcp-manager/registry.sql.ts` → migration | `bun run db generate` |
| 27 | Registry CRUD operations | `mcp-manager/registry.ts` + `test/mcp-manager/registry.test.ts` | — |

**Commit after Chunk 1a.1**

---

### Chunk 1a.2 — MCP Resolution & Connection Pool

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 28 | Session-time MCP resolver (TDD) | `mcp-manager/resolver.ts` + `test/mcp-manager/resolver.test.ts` | 6 tests pass |
| 29 | MCP connection pool | `mcp-manager/pool.ts` | — |

**Commit after Chunk 1a.2**

---

### Chunk 1a.3 — Hot-Plug Watcher & Health

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 30 | ToolRegistryWatcher (Redis Pub/Sub) + prompt injection | `mcp-manager/watcher.ts`, `prompt.ts` | — |
| 31 | Periodic health checker | `mcp-manager/health.ts` | — |

**Commit after Chunk 1a.3**

---

### Chunk 1a.4 — API Routes & Integration

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 32 | MCP management routes + wire to server | `server/routes/mcp.ts`, update `server/index.ts`, `hooks/after-tool-resolve.ts`, `src/index.ts` | — |
| 33 | **P1a Final: typecheck + test** | — | `bun typecheck && bun test` |

**Tag: `P1a-complete`**

---

## Phase 1b: Quota & Billing System

> **Plan:** `plans/2026-03-18-p1b-billing-quota.md`
> **Package:** `packages/enterprise/src/billing/`

### Chunk 1b.1 — Quota Schema & Logic

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 34 | Quota config + usage schemas | `billing/quota.sql.ts` → migration | `bun run db generate` |
| 35 | Quota check & increment (TDD) | `billing/quota.ts` + `test/billing/quota.test.ts` | 2 tests pass |

**Commit after Chunk 1b.1**

---

### Chunk 1b.2 — Rate Limiting & Circuit Breaker

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 36 | Sliding window rate limiter (TDD) | `billing/rate-limit.ts` + `test/billing/rate-limit.test.ts` | 1 test pass |
| 37 | Per-MCP circuit breaker (TDD) | `billing/circuit-breaker.ts` + `test/billing/circuit-breaker.test.ts` | 2 tests pass |

**Commit after Chunk 1b.2**

---

### Chunk 1b.3 — Cost Tracking & Audit

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 38 | Cost calculator (TDD) | `billing/cost.ts` + `test/billing/cost.test.ts` | 1 test pass |
| 39 | Audit log schema + buffered writer | `billing/audit.sql.ts`, `audit.ts` → migration | `bun run db generate` |

**Commit after Chunk 1b.3**

---

### Chunk 1b.4 — Sync, Dashboard, Routes & Hook Wiring

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 40 | Redis→PG periodic sync | `billing/sync.ts` | — |
| 41 | Dashboard aggregation queries | `billing/dashboard.ts` | — |
| 42 | Billing + Dashboard API routes + wire hooks | `server/routes/billing.ts`, `server/routes/dashboard.ts`, update hooks + server + bootstrap | — |

**After Task 42: Wire hooks into real implementations:**
- `hooks/before-prompt.ts` → call `checkQuota` + rate limiter
- `hooks/on-token-usage.ts` → call `increment` + `cost.calculate` + `audit.log`
- `hooks/on-tool-call.ts` → call `circuitBreaker.allowed` + `recordCall`

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 43 | **P1b Final: typecheck + test** | — | `bun typecheck && bun test` |

**Tag: `P1b-complete`**

---

## Phase 2a: IM Integration Layer

> **Plan:** `plans/2026-03-18-p2a-im-integration.md`
> **Package:** `packages/enterprise/src/im-adapter/` + `src/worker/`

### Chunk 2a.1 — IM Adapter & Feishu Client

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 44 | Unified IM types | `im-adapter/types.ts` | — |
| 45 | Abstract adapter interface + registry | `im-adapter/adapter.ts`, `registry.ts` | — |
| 46 | Feishu messaging API client | `im-adapter/feishu/client.ts` | — |
| 47 | Feishu webhook + cards + adapter (TDD) | `im-adapter/feishu/webhook.ts`, `cards.ts`, `adapter.ts` + `test/im-adapter/feishu-webhook.test.ts` | 2 tests pass |

**Commit after Chunk 2a.1**

---

### Chunk 2a.2 — BullMQ Job Queue & Worker

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 48 | Queue definition + producer | `worker/queue.ts`, `producer.ts` | — |
| 49 | Job consumer (Agent runner) | `worker/consumer.ts` | — |
| 50 | Worker entry point (separate process) | `worker/runner.ts`, update `package.json` scripts | — |

**Commit after Chunk 2a.2**

---

### Chunk 2a.3 — WebSocket & IM Routes

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 51 | WebSocket handler (Bun native) | `server/ws.ts` | — |
| 52 | IM webhook route + wire to server + register adapter | `server/routes/im.ts`, update `server/index.ts`, `src/index.ts` | — |
| 53 | **P2a Final: typecheck + test** | — | `bun typecheck && bun test` |

**Tag: `P2a-complete`**

---

## Phase 2b: Frontend Dashboard

> **Plan:** `plans/2026-03-18-p2b-frontend-dashboard.md`
> **Package:** `packages/dashboard/`
> **Design Spec:** `specs/2026-03-18-frontend-design-system.md`

### Chunk 2b.1 — Project Scaffold & Design Tokens

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 54 | Create dashboard package (Solid.js + Vite + Tailwind) | `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | `bun install` |
| 55 | Design tokens + global styles | `src/styles/global.css`, `themes.css` | — |
| 56 | Entry point + router | `src/index.tsx`, `src/app.tsx` | `bun run dev` starts |

**Commit after Chunk 2b.1**

---

### Chunk 2b.2 — Core Libraries & Stores

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 57 | API client + auth store + WS client + auth guard | `lib/api.ts`, `lib/ws.ts`, `lib/auth.ts`, `stores/auth.ts` | — |
| 58 | Theme store + notification store | `stores/theme.ts`, `stores/notification.ts` | — |

**Commit after Chunk 2b.2**

---

### Chunk 2b.3 — UI Components

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 59 | Base UI (Button, Input, Card, Badge, Skeleton, Modal, Toast) — 7 components | `components/ui/*.tsx` | — |
| 60 | Layout (Sidebar, Topbar, Layout, MobileNav) — 4 components | `components/layout/*.tsx` | — |

**Commit after Chunk 2b.3**

---

### Chunk 2b.4 — Chat Page

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 61 | Chat components + store + page — 8 components | `components/chat/*.tsx`, `stores/chat.ts`, `pages/Chat.tsx` | — |

**Key components:** SessionList, MessageBubble, ToolCallCard, ReasoningBlock, ChatInput, StreamingCursor, MessageList, ApprovalCard

**Commit after Chunk 2b.4**

---

### Chunk 2b.5 — MCP Market & Analytics Dashboard

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 62 | MCP marketplace (McpCard, McpFilter, store, pages) | `components/mcp/*.tsx`, `stores/mcp.ts`, `pages/McpMarket.tsx`, `pages/McpDetail.tsx` | — |
| 63 | Analytics dashboard (KpiCard, TokenChart, DeptChart, ToolRanking, TimeRangeSelector) | `components/dashboard/*.tsx`, `pages/Dashboard.tsx` | — |

**Commit after Chunk 2b.5**

---

### Chunk 2b.6 — Admin Pages & Final Integration

| # | Task | Key Files | Verify |
|---|------|-----------|--------|
| 64 | Admin pages (Users, Quotas, Audit, Settings, Login, NotFound) — 6 pages | `pages/*.tsx` | — |
| 65 | **P2b Final: dev server + typecheck + build** | — | `bun run dev` / `bun typecheck` / `bun run build` |

**Tag: `P2b-complete`**

---

## Quick Reference: Execution Command

```bash
# 每个 Task 执行后的标准验证流程:
cd packages/enterprise && bun typecheck && bun test

# 前端验证:
cd packages/dashboard && bun typecheck && bun run build
```

---

## Task Checklist (63 Tasks)

### P0: Auth & RBAC + Core Backend (Tasks 1–25)

- [ ] **T01** Create enterprise package scaffold
- [ ] **T02** Environment config (zod)
- [ ] **T03** PostgreSQL connection (Drizzle)
- [ ] **T04** Redis connection (ioredis)
- [ ] **T05** Identity mapping schema + migration
- [ ] **T06** JWT module (TDD: 3 tests)
- [ ] **T07** Feishu OAuth client
- [ ] **T08** Identity CRUD
- [ ] **T09** Auth middleware
- [ ] **T10** RBAC role schema + migration
- [ ] **T11** Permission engine (TDD: 6 tests)
- [ ] **T12** Role CRUD + seed
- [ ] **T13** Session/message/tool-log schemas + migration
- [ ] **T14** Session cache (Redis)
- [ ] **T15** Session manager
- [ ] **T16** SessionHooks interface (OpenCode Core)
- [ ] **T17** Wire beforePrompt hook
- [ ] **T18** Wire afterToolResolve + onTokenUsage + onToolCall + onToolResult
- [ ] **T19** Auth routes
- [ ] **T20** Session routes
- [ ] **T21** Health + Admin routes
- [ ] **T22** Enterprise server + bootstrap
- [ ] **T23** Shared types
- [ ] **T24** Hook implementations (stubs)
- [ ] **T25** P0 Final: typecheck + all tests

### P1a: MCP Management (Tasks 26–33)

- [ ] **T26** MCP registry schema + migration
- [ ] **T27** Registry CRUD
- [ ] **T28** MCP resolver (TDD: 6 tests)
- [ ] **T29** Connection pool
- [ ] **T30** ToolRegistryWatcher + prompt injection
- [ ] **T31** Health checker
- [ ] **T32** MCP routes + wire to server
- [ ] **T33** P1a Final: typecheck + all tests

### P1b: Billing & Quota (Tasks 34–43)

- [ ] **T34** Quota schema + migration
- [ ] **T35** Quota check & increment (TDD: 2 tests)
- [ ] **T36** Rate limiter (TDD: 1 test)
- [ ] **T37** Circuit breaker (TDD: 2 tests)
- [ ] **T38** Cost calculator (TDD: 1 test)
- [ ] **T39** Audit log schema + writer
- [ ] **T40** Redis→PG sync
- [ ] **T41** Dashboard queries
- [ ] **T42** Billing + Dashboard routes + wire hooks
- [ ] **T43** P1b Final: typecheck + all tests

### P2a: IM Integration (Tasks 44–53)

- [ ] **T44** Unified IM types
- [ ] **T45** Adapter interface + registry
- [ ] **T46** Feishu messaging client
- [ ] **T47** Feishu webhook + cards + adapter (TDD: 2 tests)
- [ ] **T48** BullMQ queue + producer
- [ ] **T49** Job consumer
- [ ] **T50** Worker entry point
- [ ] **T51** WebSocket handler
- [ ] **T52** IM routes + wire server + register adapter
- [ ] **T53** P2a Final: typecheck + all tests

### P2b: Frontend Dashboard (Tasks 54–65)

- [ ] **T54** Dashboard package scaffold
- [ ] **T55** Design tokens + CSS variables
- [ ] **T56** Entry point + router
- [ ] **T57** API/WS/auth libs + auth store
- [ ] **T58** Theme + notification stores
- [ ] **T59** Base UI components (7)
- [ ] **T60** Layout components (4)
- [ ] **T61** Chat page + components (8) + store
- [ ] **T62** MCP marketplace + detail pages
- [ ] **T63** Analytics dashboard + ECharts
- [ ] **T64** Admin pages (6)
- [ ] **T65** P2b Final: dev + typecheck + build

---

## Milestone Summary

| Milestone | After Task | Deliverable |
|-----------|-----------|-------------|
| **P0 Complete** | T25 | Auth + RBAC + Session + Hooks + API Server |
| **P1a Complete** | T33 | MCP 市场 + 热插拔 + 健康检查 |
| **P1b Complete** | T43 | 配额 + 限流 + 熔断 + 审计 + 大屏查询 |
| **P2a Complete** | T53 | 飞书 IM + BullMQ Worker + WebSocket |
| **P2b Complete** | T65 | 完整 Web Dashboard (50+ 组件) |
| **🎉 全部完成** | T65 | 企业级 AI 平台完整交付 |
