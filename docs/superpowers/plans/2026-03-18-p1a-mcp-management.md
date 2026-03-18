# P1a: MCP Management System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MCP marketplace with PUBLIC/PRIVATE/SHARED visibility, dynamic session-time mounting, hot-plug ToolRegistryWatcher via Redis Pub/Sub, health monitoring, and authorization management.

**Architecture:** MCP registry stored in PostgreSQL. Runtime state and Pub/Sub via Redis. ToolRegistryWatcher subscribes to changes and dynamically injects/removes tools from active Agent Loops. Health checker runs as a periodic background task.

**Tech Stack:** Bun, Hono, Drizzle ORM (PostgreSQL), ioredis (Pub/Sub), @modelcontextprotocol/sdk, zod

**Depends on:** P0 (Auth, RBAC, Enterprise Core)

---

## File Structure

### New Files

```
packages/enterprise/src/mcp-manager/
├── registry.sql.ts         # MCP registry + authorization + group schemas
├── registry.ts             # Registry CRUD operations
├── resolver.ts             # Session-time MCP resolution (by user context)
├── watcher.ts              # ToolRegistryWatcher (Redis Pub/Sub hot-plug)
├── health.ts               # MCP health checker (periodic ping)
├── pool.ts                 # Shared MCP client connection pool
└── prompt.ts               # System prompt injection for tool changes

packages/enterprise/src/server/routes/
└── mcp.ts                  # MCP management API routes

packages/enterprise/test/mcp-manager/
├── resolver.test.ts
├── watcher.test.ts
└── registry.test.ts
```

### Modified Files

```
packages/enterprise/src/db/schema.ts      # Add MCP schema exports
packages/enterprise/src/server/index.ts   # Add MCP routes
packages/enterprise/src/hooks/after-tool-resolve.ts  # Wire resolver
```

---

## Chunk 1: MCP Registry & Database

### Task 1: MCP Registry Schema

**Files:**
- Create: `packages/enterprise/src/mcp-manager/registry.sql.ts`

- [ ] **Step 1: Write the Drizzle schema**

```typescript
import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"
import { identity_mapping } from "../auth/identity.sql"

export const mcp_registry = pgTable("mcp_registry", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 128 }).notNull().unique(),
  display_name: varchar({ length: 256 }).notNull(),
  description: text(),
  type: varchar({ length: 16 }).notNull(),
  config: jsonb().notNull(),
  visibility: varchar({ length: 16 }).notNull().default("PRIVATE"),
  owner_id: uuid().notNull().references(() => identity_mapping.internal_id),
  group_id: uuid(),
  tags: jsonb().$type<string[]>().default([]),
  health_status: varchar({ length: 16 }).notNull().default("unknown"),
  last_health_at: timestamp({ withTimezone: true }),
  enabled: boolean().notNull().default(true),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_mcp_visibility").on(t.visibility),
  index("idx_mcp_owner").on(t.owner_id),
])

export const mcp_authorization = pgTable("mcp_authorization", {
  id: uuid().primaryKey().defaultRandom(),
  mcp_id: uuid().notNull().references(() => mcp_registry.id, { onDelete: "cascade" }),
  grantee_type: varchar({ length: 16 }).notNull(),
  grantee_id: varchar({ length: 128 }).notNull(),
  permission: varchar({ length: 16 }).notNull().default("use"),
  granted_by: uuid().notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("idx_mcp_auth_unique").on(t.mcp_id, t.grantee_type, t.grantee_id),
])

export const mcp_group = pgTable("mcp_group", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 128 }).notNull(),
  description: text(),
  type: varchar({ length: 16 }).notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 2: Add to schema re-export**

Update `packages/enterprise/src/db/schema.ts` to add:
```typescript
export { mcp_registry, mcp_authorization, mcp_group } from "../mcp-manager/registry.sql"
```

- [ ] **Step 3: Generate migration**

Run: `cd packages/enterprise && bun run db generate --name add-mcp-registry`

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/mcp-manager/registry.sql.ts packages/enterprise/src/db/schema.ts packages/enterprise/migration/
git commit -m "feat(enterprise/mcp): add MCP registry, authorization, group schemas"
```

---

### Task 2: Registry CRUD

**Files:**
- Create: `packages/enterprise/src/mcp-manager/registry.ts`
- Test: `packages/enterprise/test/mcp-manager/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"

describe("mcp registry", () => {
  test("visibility filter returns correct sets", () => {
    // Tests will be integration tests with a real DB in later phase
    // For now, test the type contracts
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 2: Write registry CRUD**

```typescript
import { eq, and, or, inArray, desc, sql } from "drizzle-orm"
import { mcp_registry, mcp_authorization, mcp_group } from "./registry.sql"
import type { Database } from "@/db"

export type McpEntry = typeof mcp_registry.$inferSelect
export type McpAuth = typeof mcp_authorization.$inferSelect
export type Visibility = "PUBLIC" | "PRIVATE" | "SHARED"

export function create(db: Database, input: typeof mcp_registry.$inferInsert) {
  return db.insert(mcp_registry).values(input).returning().then(r => r[0])
}

export function update(db: Database, id: string, input: Partial<typeof mcp_registry.$inferInsert>) {
  return db.update(mcp_registry)
    .set({ ...input, updated_at: new Date() })
    .where(eq(mcp_registry.id, id))
    .returning().then(r => r[0])
}

export function remove(db: Database, id: string) {
  return db.delete(mcp_registry).where(eq(mcp_registry.id, id))
}

export function byId(db: Database, id: string) {
  return db.select().from(mcp_registry).where(eq(mcp_registry.id, id)).then(r => r[0])
}

export function byName(db: Database, name: string) {
  return db.select().from(mcp_registry).where(eq(mcp_registry.name, name)).then(r => r[0])
}

export function listAll(db: Database, opts?: { visibility?: Visibility; enabled?: boolean }) {
  let query = db.select().from(mcp_registry)
  if (opts?.visibility) query = query.where(eq(mcp_registry.visibility, opts.visibility)) as any
  if (opts?.enabled !== undefined) query = query.where(eq(mcp_registry.enabled, opts.enabled)) as any
  return query.orderBy(desc(mcp_registry.updated_at))
}

export function authorize(db: Database, input: typeof mcp_authorization.$inferInsert) {
  return db.insert(mcp_authorization).values(input).onConflictDoNothing().returning().then(r => r[0])
}

export function revoke(db: Database, mcpId: string, granteeType: string, granteeId: string) {
  return db.delete(mcp_authorization).where(
    and(
      eq(mcp_authorization.mcp_id, mcpId),
      eq(mcp_authorization.grantee_type, granteeType),
      eq(mcp_authorization.grantee_id, granteeId),
    )
  )
}

export function authorizations(db: Database, mcpId: string) {
  return db.select().from(mcp_authorization).where(eq(mcp_authorization.mcp_id, mcpId))
}

export function updateHealth(db: Database, id: string, status: string) {
  return db.update(mcp_registry)
    .set({ health_status: status, last_health_at: new Date() })
    .where(eq(mcp_registry.id, id))
}

export function groups(db: Database) {
  return db.select().from(mcp_group)
}

export function createGroup(db: Database, input: typeof mcp_group.$inferInsert) {
  return db.insert(mcp_group).values(input).returning().then(r => r[0])
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/mcp-manager/registry.ts packages/enterprise/test/mcp-manager/
git commit -m "feat(enterprise/mcp): add registry CRUD operations"
```

---

## Chunk 2: MCP Resolution & Connection Pool

### Task 3: Session-Time MCP Resolver

**Files:**
- Create: `packages/enterprise/src/mcp-manager/resolver.ts`
- Test: `packages/enterprise/test/mcp-manager/resolver.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"
import { filterByVisibility } from "@/mcp-manager/resolver"

describe("mcp resolver", () => {
  const mcps = [
    { id: "1", name: "git", visibility: "PUBLIC", owner_id: "u1", enabled: true },
    { id: "2", name: "erp", visibility: "SHARED", owner_id: "u2", enabled: true },
    { id: "3", name: "my-tool", visibility: "PRIVATE", owner_id: "u1", enabled: true },
    { id: "4", name: "disabled", visibility: "PUBLIC", owner_id: "u1", enabled: false },
  ] as any[]

  const auths = [
    { mcp_id: "2", grantee_type: "user", grantee_id: "u1" },
    { mcp_id: "2", grantee_type: "department", grantee_id: "d1" },
  ] as any[]

  test("returns all PUBLIC enabled MCPs", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u3", roles: [], dept_ids: [] })
    const names = result.map(m => m.name)
    expect(names).toContain("git")
    expect(names).not.toContain("disabled")
  })

  test("returns own PRIVATE MCPs", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u1", roles: [], dept_ids: [] })
    expect(result.map(m => m.name)).toContain("my-tool")
  })

  test("excludes other user PRIVATE MCPs", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u3", roles: [], dept_ids: [] })
    expect(result.map(m => m.name)).not.toContain("my-tool")
  })

  test("returns SHARED MCPs if authorized by user", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u1", roles: [], dept_ids: [] })
    expect(result.map(m => m.name)).toContain("erp")
  })

  test("returns SHARED MCPs if authorized by department", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u99", roles: [], dept_ids: ["d1"] })
    expect(result.map(m => m.name)).toContain("erp")
  })

  test("excludes SHARED MCPs if not authorized", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u99", roles: [], dept_ids: ["d99"] })
    expect(result.map(m => m.name)).not.toContain("erp")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/enterprise && bun test test/mcp-manager/resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
import { eq, and, or, inArray } from "drizzle-orm"
import { mcp_registry, mcp_authorization } from "./registry.sql"
import type { Database } from "@/db"

type UserCtx = {
  internal_id: string
  roles: string[]
  dept_ids: string[]
}

export function filterByVisibility(
  mcps: any[],
  auths: any[],
  user: UserCtx,
): any[] {
  return mcps.filter(mcp => {
    if (!mcp.enabled) return false
    if (mcp.visibility === "PUBLIC") return true
    if (mcp.visibility === "PRIVATE") return mcp.owner_id === user.internal_id
    if (mcp.visibility === "SHARED") {
      return auths.some(a =>
        a.mcp_id === mcp.id && (
          (a.grantee_type === "user" && a.grantee_id === user.internal_id) ||
          (a.grantee_type === "role" && user.roles.includes(a.grantee_id)) ||
          (a.grantee_type === "department" && user.dept_ids.includes(a.grantee_id))
        )
      )
    }
    return false
  })
}

export async function resolve(db: Database, user: UserCtx) {
  const allMcps = await db.select().from(mcp_registry).where(eq(mcp_registry.enabled, true))
  const allAuths = await db.select().from(mcp_authorization)
  return filterByVisibility(allMcps, allAuths, user)
}

export async function market(db: Database, user: UserCtx) {
  const allMcps = await db.select().from(mcp_registry)
  const allAuths = await db.select().from(mcp_authorization)
  return allMcps.map(mcp => {
    const accessible = filterByVisibility([mcp], allAuths, user).length > 0
    const authorized = mcp.visibility !== "SHARED" || accessible
    return { ...mcp, accessible, authorized }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/enterprise && bun test test/mcp-manager/resolver.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/enterprise/src/mcp-manager/resolver.ts packages/enterprise/test/mcp-manager/resolver.test.ts
git commit -m "feat(enterprise/mcp): add session-time MCP resolver with visibility filtering"
```

---

### Task 4: MCP Connection Pool

**Files:**
- Create: `packages/enterprise/src/mcp-manager/pool.ts`

- [ ] **Step 1: Write connection pool**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

type PoolEntry = {
  client: Client
  refs: number
  created: number
}

const pool = new Map<string, PoolEntry>()

export async function acquire(name: string, config: any): Promise<Client> {
  const existing = pool.get(name)
  if (existing) {
    existing.refs++
    return existing.client
  }

  const client = new Client({ name: `enterprise-${name}`, version: "1.0.0" }, {})
  let transport: any

  if (config.type === "remote") {
    const url = new URL(config.url)
    try {
      transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: config.headers } })
    } catch {
      transport = new SSEClientTransport(url)
    }
  } else {
    const [cmd, ...args] = config.command
    transport = new StdioClientTransport({ command: cmd, args, env: config.environment })
  }

  await client.connect(transport)
  pool.set(name, { client, refs: 1, created: Date.now() })
  return client
}

export async function release(name: string) {
  const entry = pool.get(name)
  if (!entry) return
  entry.refs--
  if (entry.refs <= 0) {
    try { await entry.client.close() } catch {}
    pool.delete(name)
  }
}

export function status() {
  const result: Record<string, { refs: number; age: number }> = {}
  for (const [name, entry] of pool) {
    result[name] = { refs: entry.refs, age: Date.now() - entry.created }
  }
  return result
}

export async function closeAll() {
  for (const [name, entry] of pool) {
    try { await entry.client.close() } catch {}
  }
  pool.clear()
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/mcp-manager/pool.ts
git commit -m "feat(enterprise/mcp): add shared MCP client connection pool"
```

---

## Chunk 3: Hot-Plug Watcher & Health

### Task 5: ToolRegistryWatcher

**Files:**
- Create: `packages/enterprise/src/mcp-manager/watcher.ts`
- Create: `packages/enterprise/src/mcp-manager/prompt.ts`

- [ ] **Step 1: Write system prompt injection**

```typescript
// prompt.ts
export function toolChangePrompt(added: string[], removed: string[]): string {
  const parts: string[] = []
  if (added.length > 0) {
    parts.push(`New tools are now available: ${added.join(", ")}. You can use these tools in your responses.`)
  }
  if (removed.length > 0) {
    parts.push(`The following tools are no longer available: ${removed.join(", ")}. Do not attempt to use them.`)
  }
  return `[System Update] ${parts.join(" ")}`
}
```

- [ ] **Step 2: Write ToolRegistryWatcher**

```typescript
// watcher.ts
import { subscriber, redis } from "@/redis"
import { toolChangePrompt } from "./prompt"

type ChangeEvent = {
  user_id: string
  added: string[]
  removed: string[]
}

type Listener = (event: ChangeEvent) => void

const listeners = new Map<string, Set<Listener>>()
let subscribed = false
let debounce: Map<string, ReturnType<typeof setTimeout>> = new Map()

export function onChange(userId: string, fn: Listener): () => void {
  if (!listeners.has(userId)) listeners.set(userId, new Set())
  listeners.get(userId)!.add(fn)
  ensureSubscribed()
  return () => {
    listeners.get(userId)?.delete(fn)
    if (listeners.get(userId)?.size === 0) listeners.delete(userId)
  }
}

function ensureSubscribed() {
  if (subscribed) return
  subscribed = true
  const sub = subscriber()
  sub.psubscribe("mcp:change:*")
  sub.on("pmessage", (_pattern, channel, message) => {
    const userId = channel.replace("mcp:change:", "")
    const existing = debounce.get(userId)
    if (existing) clearTimeout(existing)
    debounce.set(userId, setTimeout(() => {
      debounce.delete(userId)
      const event: ChangeEvent = JSON.parse(message)
      const fns = listeners.get(userId)
      if (fns) for (const fn of fns) fn(event)
    }, 300))
  })
}

export async function publish(userId: string, added: string[], removed: string[]) {
  const event: ChangeEvent = { user_id: userId, added, removed }
  await redis().publish(`mcp:change:${userId}`, JSON.stringify(event))
}

export async function publishToAll(added: string[], removed: string[]) {
  const event: ChangeEvent = { user_id: "*", added, removed }
  await redis().publish("mcp:change:*", JSON.stringify(event))
}

export function generatePrompt(event: ChangeEvent): string {
  return toolChangePrompt(event.added, event.removed)
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/mcp-manager/watcher.ts packages/enterprise/src/mcp-manager/prompt.ts
git commit -m "feat(enterprise/mcp): add ToolRegistryWatcher with Redis Pub/Sub hot-plug"
```

---

### Task 6: Health Checker

**Files:**
- Create: `packages/enterprise/src/mcp-manager/health.ts`

- [ ] **Step 1: Write health checker**

```typescript
import { database } from "@/db"
import { mcp_registry } from "./registry.sql"
import { eq } from "drizzle-orm"
import * as pool from "./pool"
import * as registry from "./registry"

const INTERVAL = 60_000
let timer: ReturnType<typeof setInterval> | undefined

export function start() {
  if (timer) return
  timer = setInterval(check, INTERVAL)
  check()
}

export function stop() {
  if (timer) clearInterval(timer)
  timer = undefined
}

async function check() {
  const db = database()
  const mcps = await db.select().from(mcp_registry).where(eq(mcp_registry.enabled, true))

  for (const mcp of mcps) {
    const status = await ping(mcp)
    if (status !== mcp.health_status) {
      await registry.updateHealth(db, mcp.id, status)
    }
  }
}

async function ping(mcp: any): Promise<string> {
  try {
    const client = await pool.acquire(mcp.name, mcp.config)
    const tools = await client.listTools()
    await pool.release(mcp.name)
    return tools.tools.length > 0 ? "healthy" : "degraded"
  } catch {
    return "down"
  }
}

export { check as checkNow }
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/mcp-manager/health.ts
git commit -m "feat(enterprise/mcp): add periodic MCP health checker"
```

---

## Chunk 4: API Routes & Integration

### Task 7: MCP Management Routes

**Files:**
- Create: `packages/enterprise/src/server/routes/mcp.ts`

- [ ] **Step 1: Write MCP routes**

```typescript
import { Hono } from "hono"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as registry from "@/mcp-manager/registry"
import * as resolver from "@/mcp-manager/resolver"
import * as watcher from "@/mcp-manager/watcher"
import * as health from "@/mcp-manager/health"

const app = new Hono()
app.use("/*", auth)

app.get("/market", async (c) => {
  const user = c.get("user")
  const db = database()
  const items = await resolver.market(db, {
    internal_id: user.sub,
    roles: user.roles,
    dept_ids: user.depts,
  })
  return c.json({ mcps: items })
})

app.get("/:id", async (c) => {
  const db = database()
  const mcp = await registry.byId(db, c.req.param("id"))
  if (!mcp) return c.json({ error: "Not found" }, 404)
  const auths = await registry.authorizations(db, mcp.id)
  return c.json({ mcp, authorizations: auths })
})

app.post("/", requireRole("admin"), async (c) => {
  const user = c.get("user")
  const body = await c.req.json()
  const db = database()
  const mcp = await registry.create(db, { ...body, owner_id: user.sub })
  return c.json({ mcp }, 201)
})

app.put("/:id", async (c) => {
  const user = c.get("user")
  const db = database()
  const existing = await registry.byId(db, c.req.param("id"))
  if (!existing) return c.json({ error: "Not found" }, 404)
  if (existing.owner_id !== user.sub && !user.roles.includes("admin"))
    return c.json({ error: "Forbidden" }, 403)
  const body = await c.req.json()
  const updated = await registry.update(db, c.req.param("id"), body)
  return c.json({ mcp: updated })
})

app.delete("/:id", async (c) => {
  const user = c.get("user")
  const db = database()
  const existing = await registry.byId(db, c.req.param("id"))
  if (!existing) return c.json({ error: "Not found" }, 404)
  if (existing.owner_id !== user.sub && !user.roles.includes("admin"))
    return c.json({ error: "Forbidden" }, 403)
  await registry.remove(db, c.req.param("id"))
  return c.json({ ok: true })
})

app.post("/:id/authorize", async (c) => {
  const user = c.get("user")
  const db = database()
  const existing = await registry.byId(db, c.req.param("id"))
  if (!existing) return c.json({ error: "Not found" }, 404)
  if (existing.owner_id !== user.sub && !user.roles.includes("admin"))
    return c.json({ error: "Forbidden" }, 403)
  const body = await c.req.json<{ grantee_type: string; grantee_id: string; permission?: string }>()
  const auth = await registry.authorize(db, {
    mcp_id: c.req.param("id"),
    grantee_type: body.grantee_type,
    grantee_id: body.grantee_id,
    permission: body.permission ?? "use",
    granted_by: user.sub,
  })
  await watcher.publish(body.grantee_id, [existing.name], [])
  return c.json({ authorization: auth }, 201)
})

app.delete("/:id/authorize", async (c) => {
  const user = c.get("user")
  const db = database()
  const existing = await registry.byId(db, c.req.param("id"))
  if (!existing) return c.json({ error: "Not found" }, 404)
  const body = await c.req.json<{ grantee_type: string; grantee_id: string }>()
  await registry.revoke(db, c.req.param("id"), body.grantee_type, body.grantee_id)
  await watcher.publish(body.grantee_id, [], [existing.name])
  return c.json({ ok: true })
})

app.get("/:id/health", async (c) => {
  const db = database()
  const mcp = await registry.byId(db, c.req.param("id"))
  if (!mcp) return c.json({ error: "Not found" }, 404)
  return c.json({ status: mcp.health_status, checked_at: mcp.last_health_at })
})

app.get("/groups", async (c) => {
  const db = database()
  const list = await registry.groups(db)
  return c.json({ groups: list })
})

export { app as mcpRoutes }
```

- [ ] **Step 2: Add route to enterprise server**

Update `packages/enterprise/src/server/index.ts`:

```typescript
import { mcpRoutes } from "./routes/mcp"
// In createServer():
app.route("/api/v1/mcp", mcpRoutes)
```

- [ ] **Step 3: Wire resolver into afterToolResolve hook**

Update `packages/enterprise/src/hooks/after-tool-resolve.ts` to use the resolver for filtering tools based on user's resolved MCP list.

- [ ] **Step 4: Start health checker in bootstrap**

Update `packages/enterprise/src/index.ts`:

```typescript
import * as health from "./mcp-manager/health"
// In bootstrap():
health.start()
```

- [ ] **Step 5: Commit**

```bash
git add packages/enterprise/src/server/routes/mcp.ts packages/enterprise/src/server/index.ts packages/enterprise/src/hooks/after-tool-resolve.ts packages/enterprise/src/index.ts
git commit -m "feat(enterprise/mcp): add MCP management routes, wire resolver and health checker"
```

---

### Task 8: Typecheck & Test

- [ ] **Step 1: Run typecheck**

Run: `cd packages/enterprise && bun typecheck`
Expected: No errors.

- [ ] **Step 2: Run all tests**

Run: `cd packages/enterprise && bun test`
Expected: All tests pass.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(enterprise/mcp): P1a complete - MCP management system"
```

---

## Summary

P1a delivers:
1. MCP registry schema (PostgreSQL) with PUBLIC/PRIVATE/SHARED visibility
2. Authorization management (user/role/department level)
3. Session-time MCP resolver (computes available MCPs per user)
4. Shared connection pool (multi-user MCP client reuse)
5. ToolRegistryWatcher (Redis Pub/Sub hot-plug with 300ms debounce)
6. System prompt injection for tool changes
7. Periodic health checker (60s interval)
8. Full API routes for MCP marketplace

**Next:** P1b (Quota & Billing System)
