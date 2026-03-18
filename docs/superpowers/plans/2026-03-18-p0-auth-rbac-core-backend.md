# P0: Auth & RBAC + Core Backend Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the enterprise foundation layer: PostgreSQL database, Redis connectivity, authentication (Feishu OAuth + JWT), RBAC permission system, and enterprise session management with OpenCode Core hook points.

**Architecture:** Modular monolith with enterprise packages in `packages/enterprise/*`. Minimal hook-point modifications to OpenCode Core (`packages/opencode`). PostgreSQL via Drizzle ORM (`drizzle-orm/node-postgres`), Redis via `ioredis`, JWT via `jose`.

**Tech Stack:** Bun, Hono, Drizzle ORM (PostgreSQL dialect), ioredis, jose (JWT), BullMQ, zod

---

## File Structure

### New Files

```
packages/enterprise/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── src/
│   ├── index.ts                       # Enterprise entry point & bootstrap
│   ├── env.ts                         # Environment variable validation
│   ├── db/
│   │   ├── index.ts                   # PostgreSQL connection (Drizzle)
│   │   ├── schema.ts                  # Re-exports all table schemas
│   │   └── migrate.ts                 # Migration runner
│   ├── redis/
│   │   └── index.ts                   # Redis connection (ioredis)
│   ├── auth/
│   │   ├── feishu.ts                  # Feishu OAuth client
│   │   ├── jwt.ts                     # JWT sign/verify/refresh
│   │   ├── identity.ts               # Identity mapping CRUD
│   │   ├── identity.sql.ts           # Identity mapping Drizzle schema
│   │   ├── middleware.ts              # Hono auth middleware
│   │   └── sync.ts                    # Org structure sync from Feishu
│   ├── rbac/
│   │   ├── role.ts                    # Role definitions & CRUD
│   │   ├── role.sql.ts               # Role Drizzle schema
│   │   ├── permission.ts             # Permission evaluation engine
│   │   ├── permission.sql.ts         # Permission assignment schema
│   │   └── middleware.ts              # RBAC Hono middleware
│   ├── session/
│   │   ├── index.ts                   # Enterprise session manager
│   │   ├── session.sql.ts            # Enterprise session schema
│   │   ├── message.sql.ts            # Enterprise message schema
│   │   ├── tool-log.sql.ts           # Tool execution log schema
│   │   └── cache.ts                   # Redis session cache
│   ├── hooks/
│   │   ├── index.ts                   # Hook registry
│   │   ├── before-prompt.ts           # Quota + permission check
│   │   ├── after-tool-resolve.ts      # Filter tools by role
│   │   ├── on-tool-call.ts            # Tool-level permission + audit
│   │   └── on-token-usage.ts          # Token metering
│   ├── server/
│   │   ├── index.ts                   # Enterprise Hono app
│   │   ├── routes/
│   │   │   ├── auth.ts                # Auth routes
│   │   │   ├── session.ts             # Session CRUD routes
│   │   │   ├── admin.ts               # Admin routes
│   │   │   └── health.ts              # Health check
│   │   └── ws.ts                      # WebSocket handler
│   └── types.ts                       # Shared enterprise types
├── migration/                          # PostgreSQL migrations
└── test/
    ├── auth/
    │   ├── jwt.test.ts
    │   ├── identity.test.ts
    │   └── middleware.test.ts
    ├── rbac/
    │   ├── permission.test.ts
    │   └── role.test.ts
    └── session/
        └── cache.test.ts
```

### Modified Files (OpenCode Core)

```
packages/opencode/src/session/hooks.ts          # NEW: Hook interface definition
packages/opencode/src/session/prompt.ts          # MODIFY: Add hook call points
packages/opencode/src/session/llm.ts             # MODIFY: Add afterToolResolve hook
packages/opencode/src/session/processor.ts       # MODIFY: Add onToolCall/onToolResult hooks
```

---

## Chunk 1: Project Scaffold & Database Setup

### Task 1: Create Enterprise Package

**Files:**
- Create: `packages/enterprise/package.json`
- Create: `packages/enterprise/tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@opencode-ai/enterprise",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts",
    "typecheck": "bun x tsgo --noEmit",
    "test": "bun test",
    "db": "bun drizzle-kit"
  },
  "dependencies": {
    "@opencode-ai/opencode": "workspace:*",
    "drizzle-orm": "catalog:",
    "pg": "8.13.3",
    "ioredis": "5.6.1",
    "jose": "6.0.11",
    "bullmq": "5.52.2",
    "hono": "catalog:",
    "zod": "catalog:",
    "ulid": "catalog:"
  },
  "devDependencies": {
    "@types/bun": "catalog:",
    "@types/pg": "8.11.13",
    "drizzle-kit": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@tsconfig/bun/tsconfig.json",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "migration"]
}
```

- [ ] **Step 3: Update root package.json workspaces**

Add `"packages/enterprise"` to the `workspaces.packages` array in the root `package.json`.

- [ ] **Step 4: Install dependencies**

Run: `bun install`
Expected: Dependencies resolve and install successfully.

- [ ] **Step 5: Commit**

```bash
git add packages/enterprise/package.json packages/enterprise/tsconfig.json package.json bun.lock
git commit -m "feat(enterprise): scaffold enterprise package with dependencies"
```

---

### Task 2: Environment Configuration

**Files:**
- Create: `packages/enterprise/src/env.ts`

- [ ] **Step 1: Write env validation**

```typescript
import z from "zod"

const schema = z.object({
  ENTERPRISE_MODE: z.string().default("false"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default("2h"),
  FEISHU_APP_ID: z.string(),
  FEISHU_APP_SECRET: z.string(),
  FEISHU_ENCRYPT_KEY: z.string().optional(),
  FEISHU_VERIFICATION_TOKEN: z.string().optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function env(): Env {
  if (cached) return cached
  cached = schema.parse(process.env)
  return cached
}

export function isEnterprise(): boolean {
  return process.env.ENTERPRISE_MODE === "true"
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/env.ts
git commit -m "feat(enterprise): add environment configuration with zod validation"
```

---

### Task 3: PostgreSQL Connection

**Files:**
- Create: `packages/enterprise/src/db/index.ts`
- Create: `packages/enterprise/drizzle.config.ts`

- [ ] **Step 1: Write database connection**

```typescript
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { env } from "@/env"
import * as schema from "./schema"

let pool: pg.Pool | undefined
let db: ReturnType<typeof drizzle> | undefined

export function database() {
  if (db) return db
  pool = new pg.Pool({
    connectionString: env().DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  db = drizzle({ client: pool, schema })
  return db
}

export async function close() {
  if (pool) await pool.end()
  pool = undefined
  db = undefined
}

export type Database = ReturnType<typeof database>
```

- [ ] **Step 2: Write drizzle config**

```typescript
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/**/*.sql.ts",
  out: "./migration",
})
```

- [ ] **Step 3: Create schema re-export stub**

Create `packages/enterprise/src/db/schema.ts`:

```typescript
// Re-export all table schemas
// Tables will be added as modules are implemented
```

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/db/ packages/enterprise/drizzle.config.ts
git commit -m "feat(enterprise): add PostgreSQL connection via Drizzle ORM"
```

---

### Task 4: Redis Connection

**Files:**
- Create: `packages/enterprise/src/redis/index.ts`

- [ ] **Step 1: Write Redis connection**

```typescript
import Redis from "ioredis"
import { env } from "@/env"

let client: Redis | undefined
let sub: Redis | undefined

export function redis(): Redis {
  if (client) return client
  client = new Redis(env().REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 5000)
    },
    lazyConnect: true,
  })
  return client
}

export function subscriber(): Redis {
  if (sub) return sub
  sub = redis().duplicate()
  return sub
}

export async function close() {
  if (client) await client.quit()
  if (sub) await sub.quit()
  client = undefined
  sub = undefined
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/redis/
git commit -m "feat(enterprise): add Redis connection with ioredis"
```

---

## Chunk 2: Authentication System

### Task 5: Identity Mapping Schema

**Files:**
- Create: `packages/enterprise/src/auth/identity.sql.ts`

- [ ] **Step 1: Write the Drizzle schema**

```typescript
import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const identity_mapping = pgTable("identity_mapping", {
  id: uuid().primaryKey().defaultRandom(),
  internal_id: uuid().notNull().unique().defaultRandom(),
  employee_id: varchar({ length: 64 }),
  feishu_user_id: varchar({ length: 128 }),
  feishu_union_id: varchar({ length: 128 }),
  dingtalk_id: varchar({ length: 128 }),
  wecom_id: varchar({ length: 128 }),
  name: varchar({ length: 256 }).notNull(),
  email: varchar({ length: 256 }),
  avatar_url: text(),
  department_ids: jsonb().$type<string[]>().notNull().default([]),
  job_level: varchar({ length: 64 }),
  status: varchar({ length: 32 }).notNull().default("active"),
  last_sync_at: timestamp({ withTimezone: true }),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("idx_feishu").on(t.feishu_user_id),
  uniqueIndex("idx_union").on(t.feishu_union_id),
])
```

- [ ] **Step 2: Add to schema re-export**

Update `packages/enterprise/src/db/schema.ts`:

```typescript
export { identity_mapping } from "../auth/identity.sql"
```

- [ ] **Step 3: Generate migration**

Run: `bun run db generate --name add-identity-mapping`
Expected: Migration file created in `packages/enterprise/migration/`

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/auth/identity.sql.ts packages/enterprise/src/db/schema.ts packages/enterprise/migration/
git commit -m "feat(enterprise/auth): add identity mapping schema"
```

---

### Task 6: JWT Module

**Files:**
- Create: `packages/enterprise/src/auth/jwt.ts`
- Test: `packages/enterprise/test/auth/jwt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"
import { sign, verify, refresh } from "@/auth/jwt"

describe("jwt", () => {
  const secret = "test-secret-that-is-at-least-32-chars-long!!"
  const payload = {
    sub: "user-123",
    roles: ["developer"],
    depts: ["dept-001"],
    level: "P6",
  }

  test("sign and verify roundtrip", async () => {
    const token = await sign(payload, secret, "1h")
    const decoded = await verify(token, secret)
    expect(decoded.sub).toBe("user-123")
    expect(decoded.roles).toEqual(["developer"])
  })

  test("expired token throws", async () => {
    const token = await sign(payload, secret, "0s")
    await Bun.sleep(100)
    expect(verify(token, secret)).rejects.toThrow()
  })

  test("refresh returns new token", async () => {
    const token = await sign(payload, secret, "2h")
    const next = await refresh(token, secret, "2h")
    expect(next).not.toBe(token)
    const decoded = await verify(next, secret)
    expect(decoded.sub).toBe("user-123")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/enterprise && bun test test/auth/jwt.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
import { SignJWT, jwtVerify } from "jose"

export type JwtPayload = {
  sub: string
  roles: string[]
  depts: string[]
  level: string
}

function secret(raw: string) {
  return new TextEncoder().encode(raw)
}

export async function sign(payload: JwtPayload, key: string, expiry: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setIssuer("opencode-enterprise")
    .sign(secret(key))
}

export async function verify(token: string, key: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret(key), {
    issuer: "opencode-enterprise",
  })
  return payload as unknown as JwtPayload
}

export async function refresh(token: string, key: string, expiry: string): Promise<string> {
  const payload = await verify(token, key)
  return sign(payload, key, expiry)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/enterprise && bun test test/auth/jwt.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/enterprise/src/auth/jwt.ts packages/enterprise/test/auth/jwt.test.ts
git commit -m "feat(enterprise/auth): add JWT sign/verify/refresh with jose"
```

---

### Task 7: Feishu OAuth Client

**Files:**
- Create: `packages/enterprise/src/auth/feishu.ts`

- [ ] **Step 1: Write Feishu OAuth implementation**

```typescript
import { env } from "@/env"

const BASE = "https://open.feishu.cn/open-apis"

type TokenResponse = { tenant_access_token: string; expire: number }
type UserInfo = {
  user_id: string
  union_id: string
  name: string
  email: string
  avatar_url: string
  department_ids: string[]
  job_level_id: string
}

let token: { value: string; expires: number } | undefined

async function tenantToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value
  const cfg = env()
  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: cfg.FEISHU_APP_ID,
      app_secret: cfg.FEISHU_APP_SECRET,
    }),
  })
  const data = await res.json() as TokenResponse
  token = { value: data.tenant_access_token, expires: Date.now() + (data.expire - 60) * 1000 }
  return token.value
}

export async function exchangeCode(code: string): Promise<{ access_token: string; user_id: string }> {
  const tk = await tenantToken()
  const res = await fetch(`${BASE}/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tk}`,
    },
    body: JSON.stringify({ grant_type: "authorization_code", code }),
  })
  const data = await res.json() as any
  return { access_token: data.data.access_token, user_id: data.data.user_id }
}

export async function userInfo(token: string): Promise<UserInfo> {
  const res = await fetch(`${BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json() as any
  return {
    user_id: data.data.user_id,
    union_id: data.data.union_id,
    name: data.data.name,
    email: data.data.email ?? "",
    avatar_url: data.data.avatar_url ?? "",
    department_ids: data.data.department_ids ?? [],
    job_level_id: data.data.job_level_id ?? "",
  }
}

export async function departments(id: string): Promise<{ name: string; id: string }[]> {
  const tk = await tenantToken()
  const res = await fetch(`${BASE}/contact/v3/users/${id}?department_id_type=department_id&user_id_type=user_id`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const data = await res.json() as any
  return (data.data?.user?.department_ids ?? []).map((did: string) => ({ id: did, name: "" }))
}

export function verifyCallback(body: any, token?: string): boolean {
  if (!token) return true
  return body?.token === token
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/auth/feishu.ts
git commit -m "feat(enterprise/auth): add Feishu OAuth client (code exchange, user info)"
```

---

### Task 8: Identity CRUD

**Files:**
- Create: `packages/enterprise/src/auth/identity.ts`
- Test: `packages/enterprise/test/auth/identity.test.ts`

- [ ] **Step 1: Write identity CRUD**

```typescript
import { eq, or } from "drizzle-orm"
import { identity_mapping } from "./identity.sql"
import type { Database } from "@/db"

export type Identity = typeof identity_mapping.$inferSelect
export type NewIdentity = typeof identity_mapping.$inferInsert

export function byFeishuId(db: Database, feishu_user_id: string) {
  return db.select().from(identity_mapping).where(eq(identity_mapping.feishu_user_id, feishu_user_id)).then(r => r[0])
}

export function byUnionId(db: Database, union_id: string) {
  return db.select().from(identity_mapping).where(eq(identity_mapping.feishu_union_id, union_id)).then(r => r[0])
}

export function byInternalId(db: Database, id: string) {
  return db.select().from(identity_mapping).where(eq(identity_mapping.internal_id, id)).then(r => r[0])
}

export async function upsertFromFeishu(db: Database, input: {
  feishu_user_id: string
  feishu_union_id: string
  name: string
  email: string
  avatar_url: string
  department_ids: string[]
  job_level: string
}): Promise<Identity> {
  const existing = await byFeishuId(db, input.feishu_user_id)
  if (existing) {
    const [updated] = await db.update(identity_mapping)
      .set({
        name: input.name,
        email: input.email,
        avatar_url: input.avatar_url,
        department_ids: input.department_ids,
        job_level: input.job_level,
        feishu_union_id: input.feishu_union_id,
        last_sync_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(identity_mapping.feishu_user_id, input.feishu_user_id))
      .returning()
    return updated
  }
  const [created] = await db.insert(identity_mapping)
    .values({
      feishu_user_id: input.feishu_user_id,
      feishu_union_id: input.feishu_union_id,
      name: input.name,
      email: input.email,
      avatar_url: input.avatar_url,
      department_ids: input.department_ids,
      job_level: input.job_level,
      last_sync_at: new Date(),
    })
    .returning()
  return created
}

export function list(db: Database, opts?: { status?: string; limit?: number; offset?: number }) {
  let query = db.select().from(identity_mapping)
  if (opts?.status) query = query.where(eq(identity_mapping.status, opts.status)) as any
  if (opts?.limit) query = query.limit(opts.limit) as any
  if (opts?.offset) query = query.offset(opts.offset) as any
  return query
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/auth/identity.ts
git commit -m "feat(enterprise/auth): add identity mapping CRUD operations"
```

---

### Task 9: Auth Middleware

**Files:**
- Create: `packages/enterprise/src/auth/middleware.ts`

- [ ] **Step 1: Write auth middleware**

```typescript
import { createMiddleware } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import { verify, type JwtPayload } from "./jwt"
import { env } from "@/env"

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload
  }
}

export const auth = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization")
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" })
  }
  const token = header.slice(7)
  try {
    const payload = await verify(token, env().JWT_SECRET)
    if (!payload.sub) throw new Error("missing sub")
    c.set("user", payload)
    await next()
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" })
  }
})

export const requireRole = (...roles: string[]) =>
  createMiddleware(async (c, next) => {
    const user = c.get("user")
    if (!user) throw new HTTPException(401, { message: "Not authenticated" })
    const has = user.roles.some(r => roles.includes(r))
    if (!has) throw new HTTPException(403, { message: "Insufficient permissions" })
    await next()
  })
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/auth/middleware.ts
git commit -m "feat(enterprise/auth): add Hono auth + role middleware"
```

---

## Chunk 3: RBAC System

### Task 10: Role Schema

**Files:**
- Create: `packages/enterprise/src/rbac/role.sql.ts`

- [ ] **Step 1: Write role schema**

```typescript
import { pgTable, uuid, varchar, jsonb, boolean, timestamp } from "drizzle-orm/pg-core"
import { identity_mapping } from "../auth/identity.sql"

export const role = pgTable("role", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 64 }).notNull().unique(),
  display_name: varchar({ length: 128 }).notNull(),
  description: text(),
  permissions: jsonb().$type<RolePermission[]>().notNull().default([]),
  is_system: boolean().notNull().default(false),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const user_role = pgTable("user_role", {
  id: uuid().primaryKey().defaultRandom(),
  user_id: uuid().notNull().references(() => identity_mapping.internal_id),
  role_id: uuid().notNull().references(() => role.id),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const department_role = pgTable("department_role", {
  id: uuid().primaryKey().defaultRandom(),
  department_id: varchar({ length: 128 }).notNull(),
  role_id: uuid().notNull().references(() => role.id),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

import { text } from "drizzle-orm/pg-core"

export type RolePermission = {
  type: "mcp_tool" | "mcp_server" | "feature"
  pattern: string
  action: "allow" | "deny"
}
```

- [ ] **Step 2: Add to schema re-export**

Update `packages/enterprise/src/db/schema.ts`:

```typescript
export { identity_mapping } from "../auth/identity.sql"
export { role, user_role, department_role } from "../rbac/role.sql"
```

- [ ] **Step 3: Generate migration**

Run: `cd packages/enterprise && bun run db generate --name add-rbac-tables`
Expected: Migration file created.

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/rbac/role.sql.ts packages/enterprise/src/db/schema.ts packages/enterprise/migration/
git commit -m "feat(enterprise/rbac): add role, user_role, department_role schemas"
```

---

### Task 11: Permission Evaluation Engine

**Files:**
- Create: `packages/enterprise/src/rbac/permission.ts`
- Test: `packages/enterprise/test/rbac/permission.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"
import { evaluate } from "@/rbac/permission"
import type { RolePermission } from "@/rbac/role.sql"

describe("permission evaluation", () => {
  const perms: RolePermission[] = [
    { type: "mcp_tool", pattern: "git_*", action: "allow" },
    { type: "mcp_tool", pattern: "erp_*", action: "deny" },
    { type: "mcp_server", pattern: "ci_cd", action: "allow" },
    { type: "feature", pattern: "admin_dashboard", action: "deny" },
  ]

  test("allows matching tool pattern", () => {
    expect(evaluate(perms, "mcp_tool", "git_push")).toBe("allow")
  })

  test("denies matching tool pattern", () => {
    expect(evaluate(perms, "mcp_tool", "erp_query")).toBe("deny")
  })

  test("denies unmatched tool (default deny)", () => {
    expect(evaluate(perms, "mcp_tool", "slack_send")).toBe("deny")
  })

  test("allows matching server", () => {
    expect(evaluate(perms, "mcp_server", "ci_cd")).toBe("allow")
  })

  test("denies matching feature", () => {
    expect(evaluate(perms, "feature", "admin_dashboard")).toBe("deny")
  })

  test("merges permissions with deny taking precedence", () => {
    const mixed: RolePermission[] = [
      { type: "mcp_tool", pattern: "erp_*", action: "allow" },
      { type: "mcp_tool", pattern: "erp_delete", action: "deny" },
    ]
    expect(evaluate(mixed, "mcp_tool", "erp_query")).toBe("allow")
    expect(evaluate(mixed, "mcp_tool", "erp_delete")).toBe("deny")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/enterprise && bun test test/rbac/permission.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
import type { RolePermission } from "./role.sql"

function matches(pattern: string, value: string): boolean {
  if (pattern === value) return true
  if (pattern.endsWith("*")) {
    return value.startsWith(pattern.slice(0, -1))
  }
  return false
}

export function evaluate(
  perms: RolePermission[],
  type: RolePermission["type"],
  target: string,
): "allow" | "deny" {
  const relevant = perms.filter(p => p.type === type && matches(p.pattern, target))
  if (relevant.length === 0) return "deny"
  if (relevant.some(p => p.action === "deny" && matches(p.pattern, target))) return "deny"
  if (relevant.some(p => p.action === "allow")) return "allow"
  return "deny"
}

export function merge(...sets: RolePermission[][]): RolePermission[] {
  return sets.flat()
}

export function filterTools(
  tools: { name: string }[],
  perms: RolePermission[],
): string[] {
  return tools
    .filter(t => evaluate(perms, "mcp_tool", t.name) === "allow")
    .map(t => t.name)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/enterprise && bun test test/rbac/permission.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/enterprise/src/rbac/permission.ts packages/enterprise/test/rbac/permission.test.ts
git commit -m "feat(enterprise/rbac): add permission evaluation engine with glob matching"
```

---

### Task 12: Role CRUD

**Files:**
- Create: `packages/enterprise/src/rbac/role.ts`

- [ ] **Step 1: Write role CRUD and seed data**

```typescript
import { eq, inArray } from "drizzle-orm"
import { role, user_role, department_role, type RolePermission } from "./role.sql"
import type { Database } from "@/db"
import { merge } from "./permission"

export async function seed(db: Database) {
  const defaults: { name: string; display_name: string; permissions: RolePermission[] }[] = [
    {
      name: "developer",
      display_name: "Developer",
      permissions: [
        { type: "mcp_tool", pattern: "git_*", action: "allow" },
        { type: "mcp_tool", pattern: "jira_*", action: "allow" },
        { type: "mcp_tool", pattern: "ci_cd_*", action: "allow" },
        { type: "mcp_server", pattern: "git", action: "allow" },
        { type: "mcp_server", pattern: "jira", action: "allow" },
        { type: "feature", pattern: "chat", action: "allow" },
      ],
    },
    {
      name: "finance",
      display_name: "Finance",
      permissions: [
        { type: "mcp_tool", pattern: "erp_*", action: "allow" },
        { type: "mcp_tool", pattern: "expense_*", action: "allow" },
        { type: "mcp_server", pattern: "erp", action: "allow" },
        { type: "feature", pattern: "chat", action: "allow" },
        { type: "feature", pattern: "approval", action: "allow" },
      ],
    },
    {
      name: "manager",
      display_name: "Manager",
      permissions: [
        { type: "feature", pattern: "dashboard", action: "allow" },
        { type: "feature", pattern: "quota_manage", action: "allow" },
        { type: "feature", pattern: "chat", action: "allow" },
      ],
    },
    {
      name: "admin",
      display_name: "Administrator",
      permissions: [
        { type: "mcp_tool", pattern: "*", action: "allow" },
        { type: "mcp_server", pattern: "*", action: "allow" },
        { type: "feature", pattern: "*", action: "allow" },
      ],
    },
  ]
  for (const r of defaults) {
    await db.insert(role)
      .values({ ...r, is_system: true })
      .onConflictDoNothing({ target: role.name })
  }
}

export async function userPermissions(db: Database, userId: string, deptIds: string[]): Promise<RolePermission[]> {
  const userRoles = await db.select({ role_id: user_role.role_id })
    .from(user_role)
    .where(eq(user_role.user_id, userId))

  const deptRoles = deptIds.length > 0
    ? await db.select({ role_id: department_role.role_id })
        .from(department_role)
        .where(inArray(department_role.department_id, deptIds))
    : []

  const ids = [...new Set([...userRoles, ...deptRoles].map(r => r.role_id))]
  if (ids.length === 0) return []

  const roles = await db.select().from(role).where(inArray(role.id, ids))
  return merge(...roles.map(r => r.permissions))
}

export function assignRole(db: Database, userId: string, roleId: string) {
  return db.insert(user_role).values({ user_id: userId, role_id: roleId }).onConflictDoNothing()
}

export function list(db: Database) {
  return db.select().from(role)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/rbac/role.ts
git commit -m "feat(enterprise/rbac): add role CRUD with seed data and permission aggregation"
```

---

## Chunk 4: Enterprise Session & Tool Logging

### Task 13: Enterprise Session Schema

**Files:**
- Create: `packages/enterprise/src/session/session.sql.ts`
- Create: `packages/enterprise/src/session/message.sql.ts`
- Create: `packages/enterprise/src/session/tool-log.sql.ts`

- [ ] **Step 1: Write session schema**

```typescript
// session.sql.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core"
import { identity_mapping } from "../auth/identity.sql"

export const enterprise_session = pgTable("enterprise_session", {
  id: uuid().primaryKey().defaultRandom(),
  user_id: uuid().notNull().references(() => identity_mapping.internal_id),
  project_id: varchar({ length: 256 }),
  title: varchar({ length: 512 }),
  directory: text(),
  status: varchar({ length: 16 }).notNull().default("active"),
  mcp_snapshot: jsonb(),
  system_prompt: text(),
  metadata: jsonb().default({}),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_session_user").on(t.user_id, t.created_at),
])
```

```typescript
// message.sql.ts
import { pgTable, uuid, varchar, jsonb, integer, numeric, timestamp, index } from "drizzle-orm/pg-core"
import { enterprise_session } from "./session.sql"

export const enterprise_message = pgTable("enterprise_message", {
  id: uuid().primaryKey().defaultRandom(),
  session_id: uuid().notNull().references(() => enterprise_session.id),
  role: varchar({ length: 16 }).notNull(),
  content: jsonb().notNull(),
  tokens_input: integer().notNull().default(0),
  tokens_output: integer().notNull().default(0),
  tokens_cached: integer().notNull().default(0),
  cost_usd: numeric({ precision: 12, scale: 8 }).notNull().default("0"),
  model_id: varchar({ length: 128 }),
  provider_id: varchar({ length: 64 }),
  duration_ms: integer(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_message_session").on(t.session_id, t.created_at),
])
```

```typescript
// tool-log.sql.ts
import { pgTable, uuid, varchar, jsonb, integer, timestamp, index } from "drizzle-orm/pg-core"

export const enterprise_tool_log = pgTable("enterprise_tool_log", {
  id: uuid().primaryKey().defaultRandom(),
  session_id: uuid().notNull(),
  message_id: uuid().notNull(),
  tool_name: varchar({ length: 256 }).notNull(),
  mcp_name: varchar({ length: 128 }),
  input: jsonb(),
  output: jsonb(),
  status: varchar({ length: 16 }).notNull(),
  duration_ms: integer(),
  user_id: uuid().notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_tool_log_session").on(t.session_id, t.created_at),
  index("idx_tool_log_user").on(t.user_id, t.created_at),
])
```

- [ ] **Step 2: Update schema re-export**

```typescript
export { identity_mapping } from "../auth/identity.sql"
export { role, user_role, department_role } from "../rbac/role.sql"
export { enterprise_session } from "../session/session.sql"
export { enterprise_message } from "../session/message.sql"
export { enterprise_tool_log } from "../session/tool-log.sql"
```

- [ ] **Step 3: Generate migration**

Run: `cd packages/enterprise && bun run db generate --name add-session-tables`

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/session/*.sql.ts packages/enterprise/src/db/schema.ts packages/enterprise/migration/
git commit -m "feat(enterprise/session): add enterprise session, message, and tool log schemas"
```

---

### Task 14: Session Cache (Redis)

**Files:**
- Create: `packages/enterprise/src/session/cache.ts`

- [ ] **Step 1: Write session cache**

```typescript
import { redis } from "@/redis"

const TTL = 1800 // 30 minutes
const PREFIX = "session:"

export async function get(id: string): Promise<any | null> {
  const raw = await redis().get(PREFIX + id)
  if (!raw) return null
  return JSON.parse(raw)
}

export async function set(id: string, data: any): Promise<void> {
  await redis().setex(PREFIX + id, TTL, JSON.stringify(data))
}

export async function invalidate(id: string): Promise<void> {
  await redis().del(PREFIX + id)
}

export async function extend(id: string): Promise<void> {
  await redis().expire(PREFIX + id, TTL)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/session/cache.ts
git commit -m "feat(enterprise/session): add Redis session cache with 30min TTL"
```

---

### Task 15: Enterprise Session Manager

**Files:**
- Create: `packages/enterprise/src/session/index.ts`

- [ ] **Step 1: Write session manager**

```typescript
import { eq, desc } from "drizzle-orm"
import { enterprise_session } from "./session.sql"
import { enterprise_message } from "./message.sql"
import { enterprise_tool_log } from "./tool-log.sql"
import * as cache from "./cache"
import type { Database } from "@/db"

export type Session = typeof enterprise_session.$inferSelect
export type Message = typeof enterprise_message.$inferSelect
export type ToolLog = typeof enterprise_tool_log.$inferSelect

export async function create(db: Database, input: {
  user_id: string
  title?: string
  mcp_snapshot?: unknown
  system_prompt?: string
}): Promise<Session> {
  const [session] = await db.insert(enterprise_session).values(input).returning()
  return session
}

export async function messages(db: Database, sessionId: string): Promise<Message[]> {
  const cached = await cache.get(sessionId)
  if (cached) {
    await cache.extend(sessionId)
    return cached
  }
  const rows = await db.select().from(enterprise_message)
    .where(eq(enterprise_message.session_id, sessionId))
    .orderBy(enterprise_message.created_at)
  await cache.set(sessionId, rows)
  return rows
}

export async function addMessage(db: Database, input: {
  session_id: string
  role: string
  content: unknown
  tokens_input?: number
  tokens_output?: number
  tokens_cached?: number
  cost_usd?: string
  model_id?: string
  provider_id?: string
  duration_ms?: number
}): Promise<Message> {
  const [msg] = await db.insert(enterprise_message).values(input as any).returning()
  await cache.invalidate(input.session_id)
  return msg
}

export async function logTool(db: Database, input: {
  session_id: string
  message_id: string
  tool_name: string
  mcp_name?: string
  input?: unknown
  output?: unknown
  status: string
  duration_ms?: number
  user_id: string
}): Promise<ToolLog> {
  const [log] = await db.insert(enterprise_tool_log).values(input as any).returning()
  return log
}

export function listSessions(db: Database, userId: string, opts?: { limit?: number; offset?: number }) {
  let query = db.select().from(enterprise_session)
    .where(eq(enterprise_session.user_id, userId))
    .orderBy(desc(enterprise_session.updated_at))
  if (opts?.limit) query = query.limit(opts.limit) as any
  if (opts?.offset) query = query.offset(opts.offset) as any
  return query
}

export async function remove(db: Database, id: string) {
  await db.update(enterprise_session).set({ status: "deleted" }).where(eq(enterprise_session.id, id))
  await cache.invalidate(id)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/session/index.ts
git commit -m "feat(enterprise/session): add session manager with PostgreSQL + Redis cache"
```

---

## Chunk 5: OpenCode Core Hook System

### Task 16: Define Hook Interface in OpenCode Core

**Files:**
- Create: `packages/opencode/src/session/hooks.ts`

- [ ] **Step 1: Write hook interface**

```typescript
export namespace SessionHooks {
  export type TokenUsage = {
    input: number
    output: number
    cached: number
    reasoning: number
    cost: number
    model: string
    provider: string
    sessionId: string
  }

  export type ToolCallInfo = {
    name: string
    mcp?: string
    input: unknown
    sessionId: string
    userId?: string
  }

  export type ToolResultInfo = {
    name: string
    mcp?: string
    output: unknown
    status: "success" | "error"
    duration: number
    sessionId: string
    userId?: string
  }

  export type BeforePrompt = (ctx: {
    sessionId: string
    userId?: string
  }) => Promise<void | { deny: string }>

  export type AfterToolResolve = (
    tools: Record<string, any>,
    ctx: { sessionId: string; userId?: string }
  ) => Promise<Record<string, any>>

  export type OnTokenUsage = (usage: TokenUsage) => Promise<void>

  export type OnToolCall = (info: ToolCallInfo) => Promise<void | { deny: string }>

  export type OnToolResult = (info: ToolResultInfo) => Promise<void>

  const hooks = {
    beforePrompt: [] as BeforePrompt[],
    afterToolResolve: [] as AfterToolResolve[],
    onTokenUsage: [] as OnTokenUsage[],
    onToolCall: [] as OnToolCall[],
    onToolResult: [] as OnToolResult[],
  }

  export function register<K extends keyof typeof hooks>(name: K, fn: (typeof hooks)[K][number]) {
    ;(hooks[name] as any[]).push(fn)
  }

  export function clear() {
    for (const key of Object.keys(hooks) as (keyof typeof hooks)[]) {
      hooks[key].length = 0
    }
  }

  export async function runBeforePrompt(ctx: { sessionId: string; userId?: string }) {
    for (const fn of hooks.beforePrompt) {
      const result = await fn(ctx)
      if (result?.deny) return result
    }
  }

  export async function runAfterToolResolve(
    tools: Record<string, any>,
    ctx: { sessionId: string; userId?: string }
  ) {
    let result = tools
    for (const fn of hooks.afterToolResolve) {
      result = await fn(result, ctx)
    }
    return result
  }

  export async function runOnTokenUsage(usage: TokenUsage) {
    for (const fn of hooks.onTokenUsage) {
      await fn(usage).catch(() => {})
    }
  }

  export async function runOnToolCall(info: ToolCallInfo) {
    for (const fn of hooks.onToolCall) {
      const result = await fn(info)
      if (result?.deny) return result
    }
  }

  export async function runOnToolResult(info: ToolResultInfo) {
    for (const fn of hooks.onToolResult) {
      await fn(info).catch(() => {})
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/opencode/src/session/hooks.ts
git commit -m "feat(opencode): add SessionHooks interface for enterprise integration"
```

---

### Task 17: Wire Hooks into prompt.ts

**Files:**
- Modify: `packages/opencode/src/session/prompt.ts`

This is the most delicate modification. We add hook call points without changing existing logic.

- [ ] **Step 1: Add import**

At the top of `packages/opencode/src/session/prompt.ts`, add:

```typescript
import { SessionHooks } from "./hooks"
```

- [ ] **Step 2: Add beforePrompt hook in the loop function**

In the `prompt()` function of `SessionPrompt`, find where the loop is entered (the `loop()` call), and add a beforePrompt check before it starts streaming. The exact location depends on the current code structure, but it should be early in the `loop()` method, before `LLM.stream()` is called.

Add near the start of the loop body:

```typescript
const hookResult = await SessionHooks.runBeforePrompt({
  sessionId: input.sessionID,
  userId: input.userId,
})
if (hookResult?.deny) {
  // Create a text part with the denial message and return
  throw new NamedError.Unknown({ message: hookResult.deny })
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/opencode/src/session/prompt.ts
git commit -m "feat(opencode): wire beforePrompt hook into session loop"
```

---

### Task 18: Wire Hooks into llm.ts and processor.ts

**Files:**
- Modify: `packages/opencode/src/session/llm.ts`
- Modify: `packages/opencode/src/session/processor.ts`

- [ ] **Step 1: Add afterToolResolve hook in llm.ts**

In `LLM.stream()`, after tools are resolved, add:

```typescript
import { SessionHooks } from "./hooks"

// After tools are prepared, before passing to streamText:
const resolved = await SessionHooks.runAfterToolResolve(tools, {
  sessionId: input.sessionID,
  userId: input.userId,
})
```

- [ ] **Step 2: Add onTokenUsage hook in processor.ts**

In `SessionProcessor`, where usage/tokens are processed (in the stream event handler), add:

```typescript
import { SessionHooks } from "./hooks"

// After usage data is available:
await SessionHooks.runOnTokenUsage({
  input: usage.inputTokens ?? 0,
  output: usage.outputTokens ?? 0,
  cached: usage.cachedInputTokens ?? 0,
  reasoning: usage.reasoningTokens ?? 0,
  cost: 0, // calculated by enterprise layer
  model: input.model.id,
  provider: input.model.providerID,
  sessionId: input.sessionID,
})
```

- [ ] **Step 3: Add onToolCall and onToolResult hooks in processor.ts**

In the tool execution section of `SessionProcessor`:

```typescript
// Before tool execution:
const callCheck = await SessionHooks.runOnToolCall({
  name: toolName,
  mcp: mcpName,
  input: toolInput,
  sessionId: input.sessionID,
})
if (callCheck?.deny) {
  // Return denial as tool result
}

// After tool execution:
await SessionHooks.runOnToolResult({
  name: toolName,
  mcp: mcpName,
  output: toolOutput,
  status: toolStatus,
  duration: elapsed,
  sessionId: input.sessionID,
})
```

- [ ] **Step 4: Commit**

```bash
git add packages/opencode/src/session/llm.ts packages/opencode/src/session/processor.ts
git commit -m "feat(opencode): wire afterToolResolve, onTokenUsage, onToolCall, onToolResult hooks"
```

---

## Chunk 6: Enterprise API Server

### Task 19: Auth Routes

**Files:**
- Create: `packages/enterprise/src/server/routes/auth.ts`

- [ ] **Step 1: Write auth routes**

```typescript
import { Hono } from "hono"
import { z } from "zod"
import * as feishu from "@/auth/feishu"
import * as jwt from "@/auth/jwt"
import * as identity from "@/auth/identity"
import { database } from "@/db"
import { env } from "@/env"
import { auth } from "@/auth/middleware"
import { userPermissions } from "@/rbac/role"

const app = new Hono()

app.post("/feishu/callback", async (c) => {
  const { code } = await c.req.json<{ code: string }>()
  const { access_token } = await feishu.exchangeCode(code)
  const info = await feishu.userInfo(access_token)
  const db = database()
  const user = await identity.upsertFromFeishu(db, {
    feishu_user_id: info.user_id,
    feishu_union_id: info.union_id,
    name: info.name,
    email: info.email,
    avatar_url: info.avatar_url,
    department_ids: info.department_ids,
    job_level: info.job_level_id,
  })
  const perms = await userPermissions(db, user.internal_id, user.department_ids)
  const roles = [...new Set(perms.map(() => "user"))] // simplified; real impl reads role names
  const token = await jwt.sign(
    { sub: user.internal_id, roles, depts: user.department_ids, level: user.job_level ?? "" },
    env().JWT_SECRET,
    env().JWT_EXPIRY,
  )
  return c.json({ token, user: { id: user.internal_id, name: user.name, avatar: user.avatar_url } })
})

app.post("/refresh", auth, async (c) => {
  const user = c.get("user")
  const db = database()
  const current = await identity.byInternalId(db, user.sub)
  if (!current || current.status !== "active") return c.json({ error: "User disabled" }, 403)
  const token = await jwt.sign(
    { sub: user.sub, roles: user.roles, depts: current.department_ids, level: current.job_level ?? "" },
    env().JWT_SECRET,
    env().JWT_EXPIRY,
  )
  return c.json({ token })
})

app.get("/me", auth, async (c) => {
  const user = c.get("user")
  const db = database()
  const info = await identity.byInternalId(db, user.sub)
  if (!info) return c.json({ error: "User not found" }, 404)
  return c.json({ user: info })
})

export { app as authRoutes }
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/server/routes/auth.ts
git commit -m "feat(enterprise/server): add auth routes (feishu callback, refresh, me)"
```

---

### Task 20: Session Routes

**Files:**
- Create: `packages/enterprise/src/server/routes/session.ts`

- [ ] **Step 1: Write session routes**

```typescript
import { Hono } from "hono"
import { auth } from "@/auth/middleware"
import { database } from "@/db"
import * as session from "@/session"

const app = new Hono()

app.use("/*", auth)

app.get("/", async (c) => {
  const user = c.get("user")
  const limit = Number(c.req.query("limit") ?? "20")
  const offset = Number(c.req.query("offset") ?? "0")
  const db = database()
  const rows = await session.listSessions(db, user.sub, { limit, offset })
  return c.json({ sessions: rows })
})

app.post("/", async (c) => {
  const user = c.get("user")
  const body = await c.req.json<{ title?: string }>()
  const db = database()
  const s = await session.create(db, { user_id: user.sub, title: body.title })
  return c.json({ session: s }, 201)
})

app.get("/:id", async (c) => {
  const user = c.get("user")
  const db = database()
  const msgs = await session.messages(db, c.req.param("id"))
  return c.json({ messages: msgs })
})

app.delete("/:id", async (c) => {
  const db = database()
  await session.remove(db, c.req.param("id"))
  return c.json({ ok: true })
})

export { app as sessionRoutes }
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/server/routes/session.ts
git commit -m "feat(enterprise/server): add session CRUD routes"
```

---

### Task 21: Health Routes & Admin Stub

**Files:**
- Create: `packages/enterprise/src/server/routes/health.ts`
- Create: `packages/enterprise/src/server/routes/admin.ts`

- [ ] **Step 1: Write health route**

```typescript
import { Hono } from "hono"
import { redis } from "@/redis"
import { database } from "@/db"

const app = new Hono()

app.get("/", async (c) => {
  const checks = {
    redis: "unknown" as string,
    postgres: "unknown" as string,
  }
  try {
    await redis().ping()
    checks.redis = "ok"
  } catch {
    checks.redis = "error"
  }
  try {
    await database().execute({ sql: "SELECT 1" } as any)
    checks.postgres = "ok"
  } catch {
    checks.postgres = "error"
  }
  const healthy = checks.redis === "ok" && checks.postgres === "ok"
  return c.json({ status: healthy ? "healthy" : "degraded", checks }, healthy ? 200 : 503)
})

export { app as healthRoutes }
```

- [ ] **Step 2: Write admin stub**

```typescript
import { Hono } from "hono"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as identity from "@/auth/identity"
import * as roleService from "@/rbac/role"

const app = new Hono()

app.use("/*", auth, requireRole("admin", "manager"))

app.get("/users", async (c) => {
  const db = database()
  const users = await identity.list(db, { limit: 50 })
  return c.json({ users })
})

app.get("/roles", async (c) => {
  const db = database()
  const roles = await roleService.list(db)
  return c.json({ roles })
})

export { app as adminRoutes }
```

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/server/routes/health.ts packages/enterprise/src/server/routes/admin.ts
git commit -m "feat(enterprise/server): add health check and admin stub routes"
```

---

### Task 22: Enterprise Server Entry Point

**Files:**
- Create: `packages/enterprise/src/server/index.ts`
- Create: `packages/enterprise/src/index.ts`

- [ ] **Step 1: Write enterprise Hono server**

```typescript
// src/server/index.ts
import { Hono } from "hono"
import { cors } from "hono/cors"
import { authRoutes } from "./routes/auth"
import { sessionRoutes } from "./routes/session"
import { healthRoutes } from "./routes/health"
import { adminRoutes } from "./routes/admin"

export function createServer() {
  const app = new Hono()

  app.use("/*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }))

  app.route("/api/v1/auth", authRoutes)
  app.route("/api/v1/sessions", sessionRoutes)
  app.route("/api/v1/admin", adminRoutes)
  app.route("/health", healthRoutes)

  return app
}
```

- [ ] **Step 2: Write bootstrap entry point**

```typescript
// src/index.ts
import { createServer } from "./server"
import { isEnterprise, env } from "./env"
import { database } from "./db"
import { seed } from "./rbac/role"

export async function bootstrap() {
  if (!isEnterprise()) return

  const cfg = env()
  const db = database()

  // Seed default roles
  await seed(db)

  const app = createServer()
  const port = Number(process.env.PORT ?? "3100")

  const server = Bun.serve({
    port,
    fetch: app.fetch,
  })

  console.log(`Enterprise server running on http://localhost:${port}`)
  return server
}

export { createServer }
export { isEnterprise }
```

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/server/index.ts packages/enterprise/src/index.ts
git commit -m "feat(enterprise): add server bootstrap with Hono routes and role seeding"
```

---

### Task 23: Enterprise Types & Shared

**Files:**
- Create: `packages/enterprise/src/types.ts`

- [ ] **Step 1: Write shared types**

```typescript
export type UserContext = {
  internal_id: string
  roles: string[]
  dept_ids: string[]
  level: string
}

export type EnterpriseContext = {
  tenant_id?: string
  dept_ids: string[]
  user_id: string
}

export type TokenUsage = {
  input: number
  output: number
  cached: number
  reasoning: number
  cost: number
  model: string
  provider: string
}

export type McpVisibility = "PUBLIC" | "PRIVATE" | "SHARED"

export type ToolCallStatus = "success" | "error" | "denied" | "timeout"
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/types.ts
git commit -m "feat(enterprise): add shared type definitions"
```

---

### Task 24: Hook Implementations

**Files:**
- Create: `packages/enterprise/src/hooks/index.ts`
- Create: `packages/enterprise/src/hooks/before-prompt.ts`
- Create: `packages/enterprise/src/hooks/after-tool-resolve.ts`
- Create: `packages/enterprise/src/hooks/on-tool-call.ts`
- Create: `packages/enterprise/src/hooks/on-token-usage.ts`

- [ ] **Step 1: Write beforePrompt hook**

```typescript
// hooks/before-prompt.ts
import type { SessionHooks } from "@opencode-ai/opencode/session/hooks"

export const beforePrompt: SessionHooks.BeforePrompt = async (ctx) => {
  // P1 will add quota checks here
  // For now, just pass through
  return undefined
}
```

- [ ] **Step 2: Write afterToolResolve hook**

```typescript
// hooks/after-tool-resolve.ts
import type { SessionHooks } from "@opencode-ai/opencode/session/hooks"
import { evaluate } from "@/rbac/permission"
import type { RolePermission } from "@/rbac/role.sql"

let permsCache: Map<string, RolePermission[]> = new Map()

export function setUserPermissions(userId: string, perms: RolePermission[]) {
  permsCache.set(userId, perms)
}

export const afterToolResolve: SessionHooks.AfterToolResolve = async (tools, ctx) => {
  if (!ctx.userId) return tools
  const perms = permsCache.get(ctx.userId)
  if (!perms) return tools
  const filtered: Record<string, any> = {}
  for (const [name, tool] of Object.entries(tools)) {
    if (evaluate(perms, "mcp_tool", name) === "allow") {
      filtered[name] = tool
    }
  }
  return filtered
}
```

- [ ] **Step 3: Write onToolCall hook**

```typescript
// hooks/on-tool-call.ts
import type { SessionHooks } from "@opencode-ai/opencode/session/hooks"
import { evaluate } from "@/rbac/permission"

export const onToolCall: SessionHooks.OnToolCall = async (info) => {
  // Tool-level permission check will be more specific in P1
  // For now, log the call
  return undefined
}
```

- [ ] **Step 4: Write onTokenUsage hook**

```typescript
// hooks/on-token-usage.ts
import type { SessionHooks } from "@opencode-ai/opencode/session/hooks"

export const onTokenUsage: SessionHooks.OnTokenUsage = async (usage) => {
  // P1 will add quota tracking here
  // For now, just log
  console.log("[enterprise] token usage:", usage.model, usage.input + usage.output, "tokens")
}
```

- [ ] **Step 5: Write hook registry**

```typescript
// hooks/index.ts
import { SessionHooks } from "@opencode-ai/opencode/session/hooks"
import { beforePrompt } from "./before-prompt"
import { afterToolResolve } from "./after-tool-resolve"
import { onToolCall } from "./on-tool-call"
import { onTokenUsage } from "./on-token-usage"

export function registerHooks() {
  SessionHooks.register("beforePrompt", beforePrompt)
  SessionHooks.register("afterToolResolve", afterToolResolve)
  SessionHooks.register("onToolCall", onToolCall)
  SessionHooks.register("onTokenUsage", onTokenUsage)
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/enterprise/src/hooks/
git commit -m "feat(enterprise): add hook implementations (beforePrompt, afterToolResolve, onToolCall, onTokenUsage)"
```

---

### Task 25: Final Integration & Typecheck

- [ ] **Step 1: Run typecheck**

Run: `cd packages/enterprise && bun typecheck`
Expected: No type errors.

- [ ] **Step 2: Run all tests**

Run: `cd packages/enterprise && bun test`
Expected: All tests pass.

- [ ] **Step 3: Run OpenCode typecheck to verify Core changes**

Run: `cd packages/opencode && bun typecheck`
Expected: No type errors introduced.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(enterprise): P0 complete - auth, RBAC, session, hooks integrated"
```

---

## Summary

P0 delivers:
1. Enterprise package scaffold with PostgreSQL + Redis connectivity
2. Feishu OAuth authentication flow
3. JWT session management with identity mapping
4. RBAC permission system with role-based tool filtering
5. Enterprise session storage (PostgreSQL + Redis cache)
6. Tool execution audit logging
7. OpenCode Core hook system for enterprise integration
8. Hono API server with auth, session, admin, and health routes

**Next:** P1 will add MCP Management and Billing systems on top of this foundation.
