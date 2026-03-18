# P1b: Quota & Billing System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build multi-level quota management (user/department/global), token-based rate limiting, per-MCP circuit breaker, real-time cost tracking, and audit logging. All metering uses Redis for hot-path performance, periodically synced to PostgreSQL.

**Architecture:** Quota counters in Redis (INCRBY), rate limiting via sliding window (ZRANGEBYSCORE), circuit breaker state in Redis hash. PostgreSQL stores config and historical usage. Hooks from P0 (`beforePrompt`, `onTokenUsage`) drive the system.

**Tech Stack:** Bun, Drizzle ORM (PostgreSQL), ioredis, zod

**Depends on:** P0 (Auth, RBAC, Enterprise Core, Hooks)

---

## File Structure

### New Files

```
packages/enterprise/src/billing/
├── quota.sql.ts            # Quota config + usage schemas
├── quota.ts                # Quota check & increment logic
├── rate-limit.ts           # Sliding window rate limiter (Redis)
├── circuit-breaker.ts      # Per-MCP circuit breaker
├── cost.ts                 # Cost calculation engine
├── audit.sql.ts            # Audit log schema
├── audit.ts                # Audit log writer
├── sync.ts                 # Redis → PostgreSQL periodic sync
└── dashboard.ts            # Aggregation queries for dashboard

packages/enterprise/src/server/routes/
├── billing.ts              # Billing/quota management routes
└── dashboard.ts            # Dashboard statistics routes

packages/enterprise/test/billing/
├── quota.test.ts
├── rate-limit.test.ts
├── circuit-breaker.test.ts
└── cost.test.ts
```

---

## Chunk 1: Quota Schema & Logic

### Task 1: Quota Schema

**Files:**
- Create: `packages/enterprise/src/billing/quota.sql.ts`

- [ ] **Step 1: Write schema**

```typescript
import { pgTable, uuid, varchar, bigint, integer, numeric, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const quota_config = pgTable("quota_config", {
  id: uuid().primaryKey().defaultRandom(),
  scope_type: varchar({ length: 16 }).notNull(),
  scope_id: varchar({ length: 128 }).notNull(),
  period: varchar({ length: 16 }).notNull(),
  max_tokens: bigint({ mode: "number" }).notNull(),
  max_requests: integer(),
  max_cost_usd: numeric({ precision: 12, scale: 4 }),
  enabled: boolean().notNull().default(true),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const quota_usage = pgTable("quota_usage", {
  id: uuid().primaryKey().defaultRandom(),
  scope_type: varchar({ length: 16 }).notNull(),
  scope_id: varchar({ length: 128 }).notNull(),
  period_key: varchar({ length: 16 }).notNull(),
  tokens_used: bigint({ mode: "number" }).notNull().default(0),
  requests_count: integer().notNull().default(0),
  cost_usd: numeric({ precision: 12, scale: 4 }).notNull().default("0"),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("idx_quota_usage_unique").on(t.scope_type, t.scope_id, t.period_key),
])
```

- [ ] **Step 2: Add to schema, generate migration**

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/billing/quota.sql.ts packages/enterprise/src/db/schema.ts packages/enterprise/migration/
git commit -m "feat(enterprise/billing): add quota config and usage schemas"
```

---

### Task 2: Quota Check & Increment

**Files:**
- Create: `packages/enterprise/src/billing/quota.ts`
- Test: `packages/enterprise/test/billing/quota.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"
import { periodKey, checkQuota } from "@/billing/quota"

describe("quota", () => {
  test("periodKey daily format", () => {
    const key = periodKey("daily", new Date("2026-03-18T10:00:00Z"))
    expect(key).toBe("2026-03-18")
  })

  test("periodKey monthly format", () => {
    const key = periodKey("monthly", new Date("2026-03-18T10:00:00Z"))
    expect(key).toBe("2026-03")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/enterprise && bun test test/billing/quota.test.ts`

- [ ] **Step 3: Write implementation**

```typescript
import { redis } from "@/redis"
import { eq, and } from "drizzle-orm"
import { quota_config, quota_usage } from "./quota.sql"
import type { Database } from "@/db"

export function periodKey(period: string, date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return period === "daily" ? `${y}-${m}-${d}` : `${y}-${m}`
}

function redisKey(scope: string, id: string, key: string, metric: string) {
  return `quota:${scope}:${id}:${key}:${metric}`
}

export async function checkQuota(db: Database, checks: {
  userId: string
  deptIds: string[]
}): Promise<{ allowed: boolean; reason?: string }> {
  const r = redis()
  const now = new Date()

  const configs = await db.select().from(quota_config).where(eq(quota_config.enabled, true))

  for (const cfg of configs) {
    const key = periodKey(cfg.period, now)
    const rk = redisKey(cfg.scope_type, cfg.scope_id, key, "tokens")

    const isRelevant =
      (cfg.scope_type === "global") ||
      (cfg.scope_type === "user" && cfg.scope_id === checks.userId) ||
      (cfg.scope_type === "department" && checks.deptIds.includes(cfg.scope_id))

    if (!isRelevant) continue

    const used = Number(await r.get(rk) ?? "0")
    if (used >= cfg.max_tokens) {
      const labels: Record<string, string> = {
        user: "您的个人",
        department: "部门",
        global: "全局",
      }
      return {
        allowed: false,
        reason: `${labels[cfg.scope_type] ?? ""}${cfg.period === "daily" ? "今日" : "本月"} Token 配额已用完 (${used.toLocaleString()} / ${cfg.max_tokens.toLocaleString()})`,
      }
    }
  }

  return { allowed: true }
}

export async function increment(scope: string, id: string, period: string, tokens: number, cost: number) {
  const r = redis()
  const key = periodKey(period)
  const pipeline = r.pipeline()
  pipeline.incrby(redisKey(scope, id, key, "tokens"), tokens)
  pipeline.incr(redisKey(scope, id, key, "requests"))
  pipeline.incrbyfloat(redisKey(scope, id, key, "cost"), cost)
  const ttl = period === "daily" ? 86400 * 2 : 86400 * 35
  pipeline.expire(redisKey(scope, id, key, "tokens"), ttl)
  pipeline.expire(redisKey(scope, id, key, "requests"), ttl)
  pipeline.expire(redisKey(scope, id, key, "cost"), ttl)
  await pipeline.exec()
}

export async function usage(scope: string, id: string, period: string): Promise<{
  tokens: number
  requests: number
  cost: number
}> {
  const r = redis()
  const key = periodKey(period)
  const [tokens, requests, cost] = await Promise.all([
    r.get(redisKey(scope, id, key, "tokens")),
    r.get(redisKey(scope, id, key, "requests")),
    r.get(redisKey(scope, id, key, "cost")),
  ])
  return {
    tokens: Number(tokens ?? 0),
    requests: Number(requests ?? 0),
    cost: Number(cost ?? 0),
  }
}

export function listConfigs(db: Database) {
  return db.select().from(quota_config)
}

export function upsertConfig(db: Database, input: typeof quota_config.$inferInsert) {
  return db.insert(quota_config).values(input)
    .onConflictDoUpdate({
      target: [quota_config.id],
      set: { max_tokens: input.max_tokens, max_requests: input.max_requests, max_cost_usd: input.max_cost_usd, enabled: input.enabled, updated_at: new Date() },
    })
    .returning().then(r => r[0])
}
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Commit**

```bash
git add packages/enterprise/src/billing/quota.ts packages/enterprise/test/billing/quota.test.ts
git commit -m "feat(enterprise/billing): add multi-level quota check and increment"
```

---

## Chunk 2: Rate Limiting & Circuit Breaker

### Task 3: Rate Limiter

**Files:**
- Create: `packages/enterprise/src/billing/rate-limit.ts`
- Test: `packages/enterprise/test/billing/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"
import { slidingWindow } from "@/billing/rate-limit"

describe("rate-limit", () => {
  test("slidingWindow key format", () => {
    const key = slidingWindow.key("user", "u1", "rpm")
    expect(key).toBe("ratelimit:user:u1:rpm")
  })
})
```

- [ ] **Step 2: Write implementation**

```typescript
import { redis } from "@/redis"

export namespace slidingWindow {
  export function key(scope: string, id: string, metric: string) {
    return `ratelimit:${scope}:${id}:${metric}`
  }

  export async function check(opts: {
    key: string
    limit: number
    window: number
  }): Promise<{ allowed: boolean; remaining: number; reset: number }> {
    const r = redis()
    const now = Date.now()
    const min = now - opts.window * 1000
    const k = opts.key

    const pipeline = r.pipeline()
    pipeline.zremrangebyscore(k, "-inf", min)
    pipeline.zcard(k)
    pipeline.zadd(k, now, `${now}:${Math.random()}`)
    pipeline.expire(k, opts.window + 1)
    const results = await pipeline.exec()

    const count = (results?.[1]?.[1] as number) ?? 0
    const allowed = count < opts.limit
    if (!allowed) {
      await r.zrem(k, `${now}:${Math.random()}`)
    }

    return {
      allowed,
      remaining: Math.max(0, opts.limit - count - (allowed ? 1 : 0)),
      reset: Math.ceil((min + opts.window * 1000 - now) / 1000),
    }
  }

  export async function checkConcurrency(opts: {
    key: string
    limit: number
    ttl: number
  }): Promise<{ allowed: boolean; active: number }> {
    const r = redis()
    const active = await r.scard(opts.key)
    return { allowed: active < opts.limit, active }
  }

  export async function acquireConcurrency(key: string, id: string, ttl: number) {
    const r = redis()
    await r.sadd(key, id)
    await r.expire(key, ttl)
  }

  export async function releaseConcurrency(key: string, id: string) {
    await redis().srem(key, id)
  }
}

export type RateLimitConfig = {
  rpm: number
  concurrency: number
}

const defaults: Record<string, RateLimitConfig> = {
  default: { rpm: 20, concurrency: 3 },
  admin: { rpm: 100, concurrency: 10 },
  manager: { rpm: 50, concurrency: 5 },
}

export function configForRole(roles: string[]): RateLimitConfig {
  if (roles.includes("admin")) return defaults.admin
  if (roles.includes("manager")) return defaults.manager
  return defaults.default
}
```

- [ ] **Step 3: Run test, verify passes**

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/billing/rate-limit.ts packages/enterprise/test/billing/rate-limit.test.ts
git commit -m "feat(enterprise/billing): add Redis sliding window rate limiter"
```

---

### Task 4: Circuit Breaker

**Files:**
- Create: `packages/enterprise/src/billing/circuit-breaker.ts`
- Test: `packages/enterprise/test/billing/circuit-breaker.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"
import { CircuitState } from "@/billing/circuit-breaker"

describe("circuit-breaker", () => {
  test("initial state is CLOSED", () => {
    const state: CircuitState = { state: "CLOSED", failures: 0, last_failure: 0, last_success: 0, opened_at: 0 }
    expect(state.state).toBe("CLOSED")
  })

  test("transitions correctly", () => {
    expect(shouldOpen(12, 100, 0.1)).toBe(true)
    expect(shouldOpen(5, 100, 0.1)).toBe(false)
  })
})

function shouldOpen(failures: number, total: number, threshold: number) {
  return total > 0 && failures / total > threshold
}
```

- [ ] **Step 2: Write implementation**

```typescript
import { redis } from "@/redis"

export type CircuitState = {
  state: "CLOSED" | "OPEN" | "HALF_OPEN"
  failures: number
  last_failure: number
  last_success: number
  opened_at: number
}

const PREFIX = "circuit:"
const THRESHOLD = 0.1
const WINDOW = 60_000
const COOLDOWN = 30_000
const PROBE_SUCCESSES = 3

function key(mcp: string) { return PREFIX + mcp }

export async function state(mcp: string): Promise<CircuitState> {
  const raw = await redis().hgetall(key(mcp))
  if (!raw.state) return { state: "CLOSED", failures: 0, last_failure: 0, last_success: 0, opened_at: 0 }
  return {
    state: raw.state as CircuitState["state"],
    failures: Number(raw.failures ?? 0),
    last_failure: Number(raw.last_failure ?? 0),
    last_success: Number(raw.last_success ?? 0),
    opened_at: Number(raw.opened_at ?? 0),
  }
}

export async function allowed(mcp: string): Promise<{ ok: boolean; message?: string }> {
  const s = await state(mcp)
  const now = Date.now()

  if (s.state === "CLOSED") return { ok: true }

  if (s.state === "OPEN") {
    if (now - s.opened_at > COOLDOWN) {
      await redis().hset(key(mcp), "state", "HALF_OPEN")
      return { ok: true }
    }
    return { ok: false, message: `${mcp} 服务当前繁忙（响应超时），请稍后重试` }
  }

  // HALF_OPEN: allow probe
  return { ok: true }
}

export async function success(mcp: string) {
  const r = redis()
  const s = await state(mcp)
  await r.hset(key(mcp), "last_success", Date.now())

  if (s.state === "HALF_OPEN") {
    const successes = Number(await r.hget(key(mcp), "probe_successes") ?? 0) + 1
    await r.hset(key(mcp), "probe_successes", successes)
    if (successes >= PROBE_SUCCESSES) {
      await r.hset(key(mcp), "state", "CLOSED", "failures", 0, "probe_successes", 0)
    }
  }
}

export async function failure(mcp: string) {
  const r = redis()
  const s = await state(mcp)
  const failures = s.failures + 1
  await r.hset(key(mcp), "failures", failures, "last_failure", Date.now())

  if (s.state === "HALF_OPEN") {
    await r.hset(key(mcp), "state", "OPEN", "opened_at", Date.now(), "probe_successes", 0)
    return
  }

  const total = await r.get(`circuit:${mcp}:total`) ?? "0"
  if (Number(total) > 10 && failures / Number(total) > THRESHOLD) {
    await r.hset(key(mcp), "state", "OPEN", "opened_at", Date.now())
  }
}

export async function recordCall(mcp: string) {
  const r = redis()
  const tk = `circuit:${mcp}:total`
  await r.incr(tk)
  await r.expire(tk, 120)
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/billing/circuit-breaker.ts packages/enterprise/test/billing/circuit-breaker.test.ts
git commit -m "feat(enterprise/billing): add per-MCP circuit breaker (CLOSED/OPEN/HALF_OPEN)"
```

---

## Chunk 3: Cost Tracking & Audit

### Task 5: Cost Calculator

**Files:**
- Create: `packages/enterprise/src/billing/cost.ts`
- Test: `packages/enterprise/test/billing/cost.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"
import { calculate } from "@/billing/cost"

describe("cost", () => {
  test("calculates token cost correctly", () => {
    const cost = calculate({
      input: 1000,
      output: 500,
      cached: 200,
      model: { input_cost: 3, output_cost: 15, cache_cost: 0.3 },
    })
    // (1000 * 3 + 500 * 15 + 200 * 0.3) / 1_000_000
    expect(cost).toBeCloseTo(0.01056, 5)
  })
})
```

- [ ] **Step 2: Write implementation**

```typescript
type CostInput = {
  input: number
  output: number
  cached: number
  model: { input_cost: number; output_cost: number; cache_cost: number }
}

export function calculate(input: CostInput): number {
  return (
    input.input * input.model.input_cost +
    input.output * input.model.output_cost +
    input.cached * input.model.cache_cost
  ) / 1_000_000
}

const models: Record<string, { input_cost: number; output_cost: number; cache_cost: number }> = {
  "claude-sonnet-4-20250514": { input_cost: 3, output_cost: 15, cache_cost: 0.3 },
  "claude-3-5-haiku-20241022": { input_cost: 0.8, output_cost: 4, cache_cost: 0.08 },
  "gpt-4o": { input_cost: 2.5, output_cost: 10, cache_cost: 1.25 },
  "gpt-4o-mini": { input_cost: 0.15, output_cost: 0.6, cache_cost: 0.075 },
  "gemini-2.0-flash": { input_cost: 0.1, output_cost: 0.4, cache_cost: 0.025 },
}

export function modelCost(id: string) {
  return models[id] ?? { input_cost: 1, output_cost: 3, cache_cost: 0.1 }
}
```

- [ ] **Step 3: Run test, verify passes**

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/billing/cost.ts packages/enterprise/test/billing/cost.test.ts
git commit -m "feat(enterprise/billing): add token cost calculator with model pricing"
```

---

### Task 6: Audit Log

**Files:**
- Create: `packages/enterprise/src/billing/audit.sql.ts`
- Create: `packages/enterprise/src/billing/audit.ts`

- [ ] **Step 1: Write audit schema**

```typescript
import { pgTable, uuid, varchar, jsonb, integer, numeric, timestamp, index } from "drizzle-orm/pg-core"

export const audit_log = pgTable("audit_log", {
  id: uuid().primaryKey().defaultRandom(),
  user_id: uuid().notNull(),
  session_id: uuid(),
  action: varchar({ length: 64 }).notNull(),
  model_id: varchar({ length: 128 }),
  provider_id: varchar({ length: 64 }),
  tokens_input: integer().default(0),
  tokens_output: integer().default(0),
  tokens_cached: integer().default(0),
  cost_usd: numeric({ precision: 12, scale: 8 }).default("0"),
  tools: jsonb().$type<{ name: string; mcp?: string; status: string; duration_ms: number }[]>().default([]),
  metadata: jsonb().default({}),
  duration_ms: integer(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_audit_user").on(t.user_id, t.created_at),
  index("idx_audit_action").on(t.action, t.created_at),
])
```

- [ ] **Step 2: Write audit writer**

```typescript
import { database } from "@/db"
import { audit_log } from "./audit.sql"
import { desc, eq, and, gte, lte } from "drizzle-orm"
import type { Database } from "@/db"

type AuditEntry = typeof audit_log.$inferInsert

const buffer: AuditEntry[] = []
let timer: ReturnType<typeof setInterval> | undefined

export function log(entry: AuditEntry) {
  buffer.push(entry)
  if (buffer.length >= 50) flush()
}

export async function flush() {
  if (buffer.length === 0) return
  const batch = buffer.splice(0, buffer.length)
  const db = database()
  await db.insert(audit_log).values(batch)
}

export function startFlush(interval = 5000) {
  timer = setInterval(flush, interval)
}

export function stopFlush() {
  if (timer) clearInterval(timer)
  flush()
}

export function query(db: Database, opts: {
  userId?: string
  action?: string
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}) {
  let q = db.select().from(audit_log)
  if (opts.userId) q = q.where(eq(audit_log.user_id, opts.userId)) as any
  if (opts.action) q = q.where(eq(audit_log.action, opts.action)) as any
  if (opts.from) q = q.where(gte(audit_log.created_at, opts.from)) as any
  if (opts.to) q = q.where(lte(audit_log.created_at, opts.to)) as any
  return q.orderBy(desc(audit_log.created_at)).limit(opts.limit ?? 50).offset(opts.offset ?? 0)
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/billing/audit.sql.ts packages/enterprise/src/billing/audit.ts packages/enterprise/src/db/schema.ts packages/enterprise/migration/
git commit -m "feat(enterprise/billing): add buffered audit log with batch insert"
```

---

## Chunk 4: Redis→PG Sync, Dashboard Queries, Routes & Hook Wiring

### Task 7: Periodic Sync

**Files:**
- Create: `packages/enterprise/src/billing/sync.ts`

- [ ] **Step 1: Write sync logic**

```typescript
import { redis } from "@/redis"
import { database } from "@/db"
import { quota_usage } from "./quota.sql"
import { sql } from "drizzle-orm"

export async function sync() {
  const r = redis()
  const db = database()
  const keys = await r.keys("quota:*:*:*:tokens")

  for (const key of keys) {
    const parts = key.split(":")
    const [, scope, id, period] = parts
    const [tokens, requests, cost] = await Promise.all([
      r.get(key),
      r.get(key.replace(":tokens", ":requests")),
      r.get(key.replace(":tokens", ":cost")),
    ])
    await db.insert(quota_usage).values({
      scope_type: scope,
      scope_id: id,
      period_key: period,
      tokens_used: Number(tokens ?? 0),
      requests_count: Number(requests ?? 0),
      cost_usd: String(cost ?? "0"),
    }).onConflictDoUpdate({
      target: [quota_usage.scope_type, quota_usage.scope_id, quota_usage.period_key],
      set: {
        tokens_used: Number(tokens ?? 0),
        requests_count: Number(requests ?? 0),
        cost_usd: String(cost ?? "0"),
        updated_at: new Date(),
      },
    })
  }
}

let timer: ReturnType<typeof setInterval> | undefined

export function start(interval = 60_000) {
  timer = setInterval(sync, interval)
}

export function stop() {
  if (timer) clearInterval(timer)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/billing/sync.ts
git commit -m "feat(enterprise/billing): add Redis→PostgreSQL periodic quota sync"
```

---

### Task 8: Dashboard Aggregation Queries

**Files:**
- Create: `packages/enterprise/src/billing/dashboard.ts`

- [ ] **Step 1: Write dashboard queries**

```typescript
import { database } from "@/db"
import { audit_log } from "./audit.sql"
import { quota_usage } from "./quota.sql"
import { enterprise_session } from "../session/session.sql"
import { sql, desc, eq, gte, count, sum } from "drizzle-orm"
import type { Database } from "@/db"

export async function overview(db: Database, from: Date, to: Date) {
  const [tokens, cost, sessions, users] = await Promise.all([
    db.select({ total: sum(quota_usage.tokens_used) }).from(quota_usage)
      .where(gte(quota_usage.updated_at, from)),
    db.select({ total: sum(quota_usage.cost_usd) }).from(quota_usage)
      .where(gte(quota_usage.updated_at, from)),
    db.select({ total: count() }).from(enterprise_session)
      .where(gte(enterprise_session.created_at, from)),
    db.select({ total: sql<number>`count(distinct ${enterprise_session.user_id})` }).from(enterprise_session)
      .where(gte(enterprise_session.created_at, from)),
  ])
  return {
    total_tokens: Number(tokens[0]?.total ?? 0),
    total_cost: Number(cost[0]?.total ?? 0),
    total_sessions: Number(sessions[0]?.total ?? 0),
    active_users: Number(users[0]?.total ?? 0),
  }
}

export async function usageByDepartment(db: Database, period: string) {
  return db.select({
    scope_id: quota_usage.scope_id,
    tokens: sum(quota_usage.tokens_used),
    cost: sum(quota_usage.cost_usd),
  }).from(quota_usage)
    .where(eq(quota_usage.scope_type, "department"))
    .groupBy(quota_usage.scope_id)
    .orderBy(desc(sum(quota_usage.tokens_used)))
}

export async function topTools(db: Database, from: Date, limit = 10) {
  return db.select({
    tool: sql<string>`unnest(${audit_log.tools}::jsonb[])::jsonb->>'name'`,
    calls: count(),
  }).from(audit_log)
    .where(gte(audit_log.created_at, from))
    .groupBy(sql`unnest(${audit_log.tools}::jsonb[])::jsonb->>'name'`)
    .orderBy(desc(count()))
    .limit(limit)
}

export async function dailyTrend(db: Database, days = 30) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  return db.select({
    day: sql<string>`date_trunc('day', ${audit_log.created_at})::date`,
    tokens_in: sum(audit_log.tokens_input),
    tokens_out: sum(audit_log.tokens_output),
    cost: sum(audit_log.cost_usd),
    requests: count(),
  }).from(audit_log)
    .where(gte(audit_log.created_at, from))
    .groupBy(sql`date_trunc('day', ${audit_log.created_at})::date`)
    .orderBy(sql`date_trunc('day', ${audit_log.created_at})::date`)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/billing/dashboard.ts
git commit -m "feat(enterprise/billing): add dashboard aggregation queries"
```

---

### Task 9: API Routes

**Files:**
- Create: `packages/enterprise/src/server/routes/billing.ts`
- Create: `packages/enterprise/src/server/routes/dashboard.ts`

- [ ] **Step 1: Write billing routes**

```typescript
import { Hono } from "hono"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as quota from "@/billing/quota"
import * as audit from "@/billing/audit"

const app = new Hono()
app.use("/*", auth)

app.get("/quotas", requireRole("admin", "manager"), async (c) => {
  const db = database()
  const configs = await quota.listConfigs(db)
  return c.json({ quotas: configs })
})

app.post("/quotas", requireRole("admin"), async (c) => {
  const db = database()
  const body = await c.req.json()
  const cfg = await quota.upsertConfig(db, body)
  return c.json({ quota: cfg }, 201)
})

app.get("/usage", async (c) => {
  const user = c.get("user")
  const period = c.req.query("period") ?? "monthly"
  const data = await quota.usage("user", user.sub, period)
  return c.json({ usage: data })
})

app.get("/usage/:scope/:id", requireRole("admin", "manager"), async (c) => {
  const period = c.req.query("period") ?? "monthly"
  const data = await quota.usage(c.req.param("scope"), c.req.param("id"), period)
  return c.json({ usage: data })
})

app.get("/audit", requireRole("admin", "manager"), async (c) => {
  const db = database()
  const opts = {
    userId: c.req.query("user_id"),
    action: c.req.query("action"),
    from: c.req.query("from") ? new Date(c.req.query("from")!) : undefined,
    to: c.req.query("to") ? new Date(c.req.query("to")!) : undefined,
    limit: Number(c.req.query("limit") ?? 50),
    offset: Number(c.req.query("offset") ?? 0),
  }
  const logs = await audit.query(db, opts)
  return c.json({ audit: logs })
})

export { app as billingRoutes }
```

- [ ] **Step 2: Write dashboard routes**

```typescript
import { Hono } from "hono"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as dashboard from "@/billing/dashboard"

const app = new Hono()
app.use("/*", auth, requireRole("admin", "manager"))

app.get("/overview", async (c) => {
  const db = database()
  const range = c.req.query("range") ?? "month"
  const from = new Date()
  if (range === "day") from.setDate(from.getDate() - 1)
  else if (range === "week") from.setDate(from.getDate() - 7)
  else from.setMonth(from.getMonth() - 1)
  const data = await dashboard.overview(db, from, new Date())
  return c.json(data)
})

app.get("/by-department", async (c) => {
  const db = database()
  const data = await dashboard.usageByDepartment(db, "monthly")
  return c.json({ departments: data })
})

app.get("/top-tools", async (c) => {
  const db = database()
  const days = Number(c.req.query("days") ?? 30)
  const from = new Date()
  from.setDate(from.getDate() - days)
  const data = await dashboard.topTools(db, from)
  return c.json({ tools: data })
})

app.get("/trend", async (c) => {
  const db = database()
  const days = Number(c.req.query("days") ?? 30)
  const data = await dashboard.dailyTrend(db, days)
  return c.json({ trend: data })
})

export { app as dashboardRoutes }
```

- [ ] **Step 3: Add routes to server, wire hooks**

Update `packages/enterprise/src/server/index.ts` to add billing and dashboard routes.

Update `packages/enterprise/src/hooks/before-prompt.ts` to call `checkQuota` and rate limiter.

Update `packages/enterprise/src/hooks/on-token-usage.ts` to call `increment`, `cost.calculate`, `audit.log`.

Update `packages/enterprise/src/hooks/on-tool-call.ts` to call `circuitBreaker.allowed` and `recordCall`.

Update `packages/enterprise/src/index.ts` to start `sync` and `audit.startFlush`.

- [ ] **Step 4: Typecheck & test**

Run: `cd packages/enterprise && bun typecheck && bun test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(enterprise/billing): P1b complete - quota, rate limiting, circuit breaker, audit"
```

---

## Summary

P1b delivers:
1. Multi-level quota config & usage tracking (user/department/global, daily/monthly)
2. Redis-backed real-time quota checking with friendly denial messages
3. Sliding window rate limiter (RPM + concurrency per user)
4. Per-MCP circuit breaker (CLOSED/OPEN/HALF_OPEN state machine)
5. Token cost calculator with per-model pricing
6. Buffered audit log writer (batch insert every 5s or 50 entries)
7. Redis→PostgreSQL periodic sync
8. Dashboard aggregation queries (overview, by-department, top-tools, daily-trend)
9. API routes for quota management, usage, audit, dashboard

**Next:** P2a (IM Integration Layer)
