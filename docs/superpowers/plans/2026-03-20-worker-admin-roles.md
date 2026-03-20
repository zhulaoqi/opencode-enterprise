# Worker 节点管理 & 角色身份展示 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为平台增加 Worker 可视化管理、角色描述增强、新用户默认角色分配、用户身份展示。

**Architecture:** 后端在 Platform 增加 metrics 采集模块和 admin Worker API；前端在 Dashboard 增加 Workers 管理页面、角色常量库，并在 Sidebar 和 Settings 页面展示角色信息。Worker 指标通过 bootstrap.ts 的 setInterval 采集写入 Redis，Platform API 聚合后返回前端。

**Tech Stack:** TypeScript, Bun, Hono, Drizzle ORM, PostgreSQL, Redis (ioredis), SolidJS, TailwindCSS, lucide-solid

---

## File Structure

### New Files
- `packages/platform/src/worker-manager/metrics.ts` — Redis 读写 Worker 指标
- `packages/dashboard/src/lib/roles.ts` — 前端角色常量 map + 工具函数
- `packages/dashboard/src/pages/Workers.tsx` — Worker 管理页面

### Modified Files
- `packages/platform/src/worker-manager/bootstrap.ts` — 增加指标采集 setInterval
- `packages/platform/src/server/routes/admin.ts` — 增加 Worker 管理 API 端点
- `packages/platform/src/server/index.ts` — 无需改动（admin 路由已挂载）
- `packages/platform/src/rbac/role.ts` — seed 描述 + 新用户 auto-assign helper
- `packages/platform/src/server/routes/auth.ts` — 登录后为新用户分配 developer 角色
- `packages/dashboard/src/stores/auth.ts` — User 类型扩展
- `packages/dashboard/src/components/layout/Sidebar.tsx` — 节点管理导航 + 角色标签
- `packages/dashboard/src/pages/Settings.tsx` — 角色详情区域
- `packages/dashboard/src/app.tsx` — 添加 /admin/workers 路由

---

## Chunk 1: Backend

### Task 1: Worker 指标 Redis 模块

**Files:**
- Create: `packages/platform/src/worker-manager/metrics.ts`

- [ ] **Step 1: 创建 metrics.ts**

```typescript
import { redis } from "@/redis"

const PREFIX = "worker:metrics:"
const TTL = 30

export type Metrics = {
  cpu: number
  rss: number
  heap: number
  sessions: number
  tokens: { input: number; output: number }
  ts: number
}

export async function write(uid: string, data: Metrics) {
  await redis().set(PREFIX + uid, JSON.stringify(data), "EX", TTL)
}

export async function read(uid: string): Promise<Metrics | null> {
  const raw = await redis().get(PREFIX + uid)
  return raw ? JSON.parse(raw) : null
}

export async function all(): Promise<[string, Metrics][]> {
  const keys = await redis().keys(PREFIX + "*")
  const result: [string, Metrics][] = []
  for (const key of keys) {
    const raw = await redis().get(key)
    if (raw) result.push([key.slice(PREFIX.length), JSON.parse(raw)])
  }
  return result
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `cd packages/platform && bun run typecheck`
Expected: 无新增错误

- [ ] **Step 3: 提交**

```bash
git add packages/platform/src/worker-manager/metrics.ts
git commit -m "feat(platform): add worker metrics redis module"
```

---

### Task 2: Worker bootstrap 指标采集

**Files:**
- Modify: `packages/platform/src/worker-manager/bootstrap.ts`

当前 bootstrap.ts 在第 44 行 `await new Promise(() => {})` 前结束。需要在此之前加入 setInterval 采集指标。

- [ ] **Step 1: 在 bootstrap.ts 中添加指标采集**

在 `await new Promise(() => {})` **之前**插入：

```typescript
const METRICS_INTERVAL = 10_000

async function report() {
  const cpu = process.cpuUsage()
  const mem = process.memoryUsage()
  let sessions = 0
  try {
    const res = await fetch(`http://localhost:${port}/session`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const list = await res.json()
      sessions = Array.isArray(list) ? list.length : 0
    }
  } catch {}
  const payload = JSON.stringify({
    cpu: Math.round((cpu.user + cpu.system) / 1000 / METRICS_INTERVAL * 100 * 10) / 10,
    rss: Math.round(mem.rss / 1024 / 1024),
    heap: Math.round(mem.heapUsed / 1024 / 1024),
    sessions,
    tokens: { input: 0, output: 0 },
    ts: Date.now(),
  })
  try {
    const { redis } = await import("@/redis")
    await redis().set(`worker:metrics:${uid}`, payload, "EX", 30)
  } catch {}
}

setInterval(report, METRICS_INTERVAL)
```

注意：bootstrap.ts 运行在 Worker 进程中，需要直接用 ioredis 连 Redis，因为 Worker 进程也能访问 REDIS_URL 环境变量。

**重要**：Worker 进程的 `@/redis` 路径是 platform 包内的。但 bootstrap.ts 是由 platform spawn 的，运行时 import 的是 platform 的模块。这里应该直接用 `ioredis` 或者通过环境变量中的 REDIS_URL 创建一个局部 Redis 客户端，避免依赖 platform 的 `@/redis`。

改用直接 Redis：

```typescript
import Redis from "ioredis"

let metricsRedis: InstanceType<typeof Redis> | null = null
function getRedis() {
  if (metricsRedis) return metricsRedis
  metricsRedis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379")
  return metricsRedis
}

let prev = process.cpuUsage()

async function report() {
  const cur = process.cpuUsage(prev)
  prev = process.cpuUsage()
  const mem = process.memoryUsage()
  let sessions = 0
  try {
    const res = await fetch(`http://localhost:${port}/session`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const body = await res.json()
      sessions = Array.isArray(body) ? body.length : 0
    }
  } catch {}
  const pct = Math.round((cur.user + cur.system) / 1000 / METRICS_INTERVAL * 100 * 10) / 10
  const payload = JSON.stringify({
    cpu: pct,
    rss: Math.round(mem.rss / 1024 / 1024),
    heap: Math.round(mem.heapUsed / 1024 / 1024),
    sessions,
    tokens: { input: 0, output: 0 },
    ts: Date.now(),
  })
  try {
    await getRedis().set(`worker:metrics:${uid}`, payload, "EX", 30)
  } catch {}
}

const METRICS_INTERVAL = 10_000
setInterval(report, METRICS_INTERVAL)
```

在 `bootstrap.ts` 的顶部 `import` 区域添加 `import Redis from "ioredis"`。
在 `console.log(...)` 行之后、`await new Promise(() => {})` 之前插入上述代码。

- [ ] **Step 2: 验证类型检查通过**

Run: `cd packages/platform && bun run typecheck`
Expected: 无新增错误

- [ ] **Step 3: 提交**

```bash
git add packages/platform/src/worker-manager/bootstrap.ts
git commit -m "feat(platform): collect worker metrics every 10s"
```

---

### Task 3: Admin Worker API 端点

**Files:**
- Modify: `packages/platform/src/server/routes/admin.ts`

在现有 admin 路由中追加 3 个端点。现有 admin.ts 已有 `.use(auth).use(requireRole("admin", "manager"))`，所以新端点自动继承认证和角色校验。

- [ ] **Step 1: 在 admin.ts 末尾（最后一个 `.post("/seed", ...)` 之后）追加 Worker API**

需要额外 import：
```typescript
import * as manager from "@/worker-manager/manager"
import * as registryMod from "@/worker-manager/registry"
import * as metrics from "@/worker-manager/metrics"
```

追加路由：
```typescript
  .get("/workers", async (c) => {
    const db = database()
    const entries = await registryMod.all()
    const result = await Promise.all(
      entries.map(async ([uid, entry]) => {
        const user = await identity.byInternalId(db, uid)
        const ok = await manager.healthy(entry.port)
        const m = await metrics.read(uid)
        return {
          uid,
          name: user?.name ?? "Unknown",
          email: user?.email ?? "",
          avatar: user?.avatar_url ?? "",
          port: entry.port,
          pid: entry.pid,
          status: ok ? "healthy" : "unhealthy",
          started: entry.started,
          active: entry.active,
          metrics: m,
        }
      }),
    )
    return c.json(result)
  })
  .post("/workers/:uid/restart", requireRole("admin"), async (c) => {
    const uid = c.req.param("uid")
    await manager.stop(uid)
    const worker = await manager.spawn(uid)
    return c.json({ ok: true, port: worker.port })
  })
  .post("/workers/:uid/stop", requireRole("admin"), async (c) => {
    const uid = c.req.param("uid")
    await manager.stop(uid)
    return c.json({ ok: true })
  })
```

注意：`/api/admin` 路由已在 `server/index.ts` 中挂载，无需修改 index.ts。

- [ ] **Step 2: 验证类型检查通过**

Run: `cd packages/platform && bun run typecheck`
Expected: 无新增错误

- [ ] **Step 3: 提交**

```bash
git add packages/platform/src/server/routes/admin.ts
git commit -m "feat(platform): add worker management admin API"
```

---

### Task 4: 角色描述完善 & 新用户自动分配

**Files:**
- Modify: `packages/platform/src/rbac/role.ts`

- [ ] **Step 1: 更新 seed() 函数中的角色 defaults，为每个角色增加 description**

将 `defaults` 数组中的每个对象增加 `description` 字段：

```typescript
const defaults: { name: string; display_name: string; description: string; permissions: RolePermission[] }[] = [
  {
    name: "developer",
    display_name: "开发者",
    description: "使用 AI 对话、执行代码任务，适合所有研发人员",
    permissions: [{ type: "feature", pattern: "chat", action: "allow" }],
  },
  {
    name: "finance",
    display_name: "财务",
    description: "在开发者基础上可审批资源申请，适合财务/审批人员",
    permissions: [
      { type: "feature", pattern: "chat", action: "allow" },
      { type: "feature", pattern: "approval", action: "allow" },
    ],
  },
  {
    name: "manager",
    display_name: "管理者",
    description: "可查看仪表盘、管理配额、查看节点状态（只读），适合团队负责人",
    permissions: [
      { type: "feature", pattern: "dashboard", action: "allow" },
      { type: "feature", pattern: "quota_manage", action: "allow" },
      { type: "feature", pattern: "chat", action: "allow" },
    ],
  },
  {
    name: "admin",
    display_name: "管理员",
    description: "全部权限，包括用户管理、模型配置、节点操控，适合系统运维人员",
    permissions: [{ type: "feature", pattern: "*", action: "allow" }],
  },
]
```

更新 `onConflictDoUpdate` 的 `set` 为包含 `description`：

```typescript
set: { display_name: r.display_name, description: r.description, permissions: r.permissions },
```

- [ ] **Step 2: 增加 autoAssign 函数**

在 `role.ts` 末尾添加：

```typescript
export async function autoAssign(db: Database, userId: string) {
  const dev = await db.select().from(role).where(eq(role.name, "developer")).then((r) => r[0])
  if (!dev) return
  await db.insert(user_role).values({ user_id: userId, role_id: dev.id }).onConflictDoNothing()
}
```

- [ ] **Step 3: 验证类型检查通过**

Run: `cd packages/platform && bun run typecheck`
Expected: 无新增错误

- [ ] **Step 4: 提交**

```bash
git add packages/platform/src/rbac/role.ts
git commit -m "feat(platform): add role descriptions and auto-assign developer"
```

---

### Task 5: 新用户登录时分配 developer 角色

**Files:**
- Modify: `packages/platform/src/server/routes/auth.ts`

- [ ] **Step 1: 在 auth.ts 的 feishu/callback 处理中，bootstrap() 之后调用 autoAssign()**

在 `auth.ts` 第 52 行 `await rbac.bootstrap(db, user.internal_id)` 之后添加：

```typescript
await rbac.autoAssign(db, user.internal_id)
```

- [ ] **Step 2: 验证类型检查通过**

Run: `cd packages/platform && bun run typecheck`
Expected: 无新增错误

- [ ] **Step 3: 提交**

```bash
git add packages/platform/src/server/routes/auth.ts
git commit -m "feat(platform): auto-assign developer role on first login"
```

---

## Chunk 2: Frontend

### Task 6: 前端角色常量库

**Files:**
- Create: `packages/dashboard/src/lib/roles.ts`

- [ ] **Step 1: 创建 roles.ts**

```typescript
export const ROLES = {
  admin: { label: "管理员", color: "red", desc: "全部权限，包括用户管理、模型配置、节点操控，适合系统运维人员" },
  manager: { label: "管理者", color: "blue", desc: "可查看仪表盘、管理配额、查看节点状态（只读），适合团队负责人" },
  finance: { label: "财务", color: "purple", desc: "在开发者基础上可审批资源申请，适合财务/审批人员" },
  developer: { label: "开发者", color: "green", desc: "使用 AI 对话、执行代码任务，适合所有研发人员" },
} as const

export type RoleName = keyof typeof ROLES

const PRIORITY: RoleName[] = ["admin", "manager", "finance", "developer"]

export function primary(roles: string[]): RoleName | null {
  for (const r of PRIORITY) {
    if (roles.includes(r)) return r
  }
  return null
}

const COLORS: Record<string, string> = {
  red: "bg-red-500/10 text-red-600 border-red-200",
  blue: "bg-blue-500/10 text-blue-600 border-blue-200",
  purple: "bg-purple-500/10 text-purple-600 border-purple-200",
  green: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
}

export function badge(name: RoleName): string {
  return COLORS[ROLES[name].color] ?? COLORS.green!
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/dashboard/src/lib/roles.ts
git commit -m "feat(dashboard): add role constants and utilities"
```

---

### Task 7: User 类型扩展

**Files:**
- Modify: `packages/dashboard/src/stores/auth.ts`

- [ ] **Step 1: 扩展 User 类型**

在 `auth.ts` 的 `User` 类型中增加 `departments` 和 `level` 字段：

当前:
```typescript
export type User = {
  id: string
  name: string
  email?: string
  avatar?: string
  roles?: string[]
}
```

改为:
```typescript
export type User = {
  id: string
  name: string
  email?: string
  avatar?: string
  roles?: string[]
  departments?: string[]
  level?: string
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/dashboard/src/stores/auth.ts
git commit -m "feat(dashboard): extend User type with departments and level"
```

---

### Task 8: Sidebar 增加节点管理导航 + 角色标签

**Files:**
- Modify: `packages/dashboard/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: 添加 import**

在 Sidebar.tsx 顶部添加：
```typescript
import { Server } from "lucide-solid"
```
（注意 `Server` 图标需要加到 import 列表中）

添加角色库 import：
```typescript
import { ROLES, primary, badge as roleBadge, type RoleName } from "../../lib/roles"
```

- [ ] **Step 2: 在 main 导航数组中添加节点管理**

在 `main` 数组的 `{ href: "/admin/models", ... }` 之后添加：
```typescript
{ href: "/admin/workers", label: "节点管理", icon: Server, roles: ["admin", "manager"] },
```

- [ ] **Step 3: 在 Sidebar 底部的用户名下方增加角色标签**

在底部展开模式区域（`<div class="min-w-0">` 内部），在用户名 `<p>` 之后增加：

```tsx
{(() => {
  const r = primary(user()?.roles ?? [])
  if (!r) return null
  return (
    <span class={`inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border ${roleBadge(r)}`}>
      {ROLES[r].label}
    </span>
  )
})()}
```

- [ ] **Step 4: 验证类型检查通过**

Run: `cd packages/dashboard && npx tsc --noEmit`
Expected: 无新增错误（如果 dashboard 有 typecheck 脚本则用那个）

- [ ] **Step 5: 提交**

```bash
git add packages/dashboard/src/components/layout/Sidebar.tsx
git commit -m "feat(dashboard): add workers nav and role badge in sidebar"
```

---

### Task 9: Settings 角色详情区域

**Files:**
- Modify: `packages/dashboard/src/pages/Settings.tsx`

- [ ] **Step 1: 添加 import**

```typescript
import { For } from "solid-js"
import { ROLES, badge as roleBadge, type RoleName } from "../lib/roles"
```

- [ ] **Step 2: 在个人资料 Card 中，邮箱下方增加角色和部门信息**

在 Settings.tsx 的个人资料 Card 内，`</div></div>` 闭合之后、`</Card>` 之前，追加：

```tsx
<div class="mt-4 pt-4 border-t border-[var(--color-border)]">
  <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-2">我的角色</h3>
  <div class="flex flex-wrap gap-2">
    <For each={user()?.roles?.filter((r): r is RoleName => r in ROLES) ?? []}>
      {(r) => (
        <div class={`px-2.5 py-1.5 rounded-[var(--radius-md)] border text-xs ${roleBadge(r)}`}>
          <span class="font-medium">{ROLES[r].label}</span>
          <span class="ml-1.5 opacity-70">{ROLES[r].desc}</span>
        </div>
      )}
    </For>
  </div>
  <Show when={user()?.departments?.length}>
    <p class="text-xs text-[var(--color-text-muted)] mt-2">
      部门：{user()!.departments!.join(", ")}
    </p>
  </Show>
  <Show when={user()?.level}>
    <p class="text-xs text-[var(--color-text-muted)] mt-1">
      职级：{user()!.level}
    </p>
  </Show>
</div>
```

- [ ] **Step 3: 验证类型检查通过**

Run: `cd packages/dashboard && npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 4: 提交**

```bash
git add packages/dashboard/src/pages/Settings.tsx
git commit -m "feat(dashboard): show role details in settings page"
```

---

### Task 10: Worker 管理页面

**Files:**
- Create: `packages/dashboard/src/pages/Workers.tsx`

- [ ] **Step 1: 创建 Workers.tsx**

```tsx
import { createSignal, createEffect, onCleanup, Show, For } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { user } from "../stores/auth"
import { RefreshCw, Server, StopCircle, PlayCircle, RotateCw, Search } from "lucide-solid"

type WorkerMetrics = {
  cpu: number
  rss: number
  heap: number
  sessions: number
  tokens: { input: number; output: number }
  ts: number
}

type WorkerEntry = {
  uid: string
  name: string
  email: string
  avatar: string
  port: number
  pid: number
  status: "healthy" | "unhealthy" | "offline"
  started: number
  active: number
  metrics: WorkerMetrics | null
}

const REFRESH = 10_000

function ago(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return "刚刚"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function cpuColor(v: number): string {
  if (v > 80) return "text-red-600"
  if (v > 50) return "text-amber-600"
  return "text-emerald-600"
}

function memColor(v: number): string {
  if (v > 512) return "text-red-600"
  if (v > 256) return "text-amber-600"
  return "text-emerald-600"
}

function statusBadge(s: string) {
  if (s === "healthy") return { text: "运行中", cls: "bg-emerald-500/10 text-emerald-600" }
  if (s === "unhealthy") return { text: "异常", cls: "bg-red-500/10 text-red-600" }
  return { text: "离线", cls: "bg-gray-500/10 text-gray-500" }
}

function isAdmin() {
  return user()?.roles?.includes("admin") ?? false
}

export default function Workers() {
  const [workers, setWorkers] = createSignal<WorkerEntry[]>([])
  const [loading, setLoading] = createSignal(false)
  const [search, setSearch] = createSignal("")
  const [confirm, setConfirm] = createSignal<{ uid: string; action: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api.get<WorkerEntry[]>("/admin/workers")
      setWorkers(data)
    } catch (e) {
      console.error("[workers] load failed:", e)
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    load()
    const id = setInterval(load, REFRESH)
    onCleanup(() => clearInterval(id))
  })

  async function act(uid: string, action: string) {
    setConfirm(null)
    try {
      if (action === "restart") await api.post(`/admin/workers/${uid}/restart`, {})
      if (action === "stop") await api.post(`/admin/workers/${uid}/stop`, {})
      await load()
    } catch (e) {
      console.error(`[workers] ${action} failed:`, e)
    }
  }

  const filtered = () => {
    const q = search().toLowerCase()
    if (!q) return workers()
    return workers().filter((w) => w.name.toLowerCase().includes(q) || w.email.toLowerCase().includes(q))
  }

  const online = () => workers().filter((w) => w.status === "healthy").length
  const offline = () => workers().filter((w) => w.status !== "healthy").length
  const totalMem = () => workers().reduce((sum, w) => sum + (w.metrics?.rss ?? 0), 0)
  const totalTokens = () =>
    workers().reduce((sum, w) => sum + (w.metrics?.tokens.input ?? 0) + (w.metrics?.tokens.output ?? 0), 0)

  return (
    <div class="p-4 max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">节点管理</h1>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"
          onClick={load}
        >
          <RefreshCw size={14} class={loading() ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      {/* Summary Cards */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <p class="text-xs text-[var(--color-text-muted)]">在线节点</p>
          <p class="text-2xl font-bold text-emerald-600">{online()}</p>
        </Card>
        <Card>
          <p class="text-xs text-[var(--color-text-muted)]">离线/异常</p>
          <p class="text-2xl font-bold text-red-600">{offline()}</p>
        </Card>
        <Card>
          <p class="text-xs text-[var(--color-text-muted)]">总内存</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">{totalMem()} MB</p>
        </Card>
        <Card>
          <p class="text-xs text-[var(--color-text-muted)]">总 Token</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">{fmt(totalTokens())}</p>
        </Card>
      </div>

      {/* Search */}
      <div class="relative mb-4">
        <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="搜索用户名或邮箱..."
          class="w-full pl-9 pr-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
      </div>

      {/* Table */}
      <div class="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table class="w-full text-sm">
          <thead class="bg-[var(--color-muted)]">
            <tr class="text-left text-[var(--color-text-muted)]">
              <th class="px-4 py-3 font-medium">用户</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">CPU%</th>
              <th class="px-4 py-3 font-medium">内存</th>
              <th class="px-4 py-3 font-medium">会话</th>
              <th class="px-4 py-3 font-medium">Token</th>
              <th class="px-4 py-3 font-medium">启动时间</th>
              <th class="px-4 py-3 font-medium">最近活跃</th>
              <Show when={isAdmin()}>
                <th class="px-4 py-3 font-medium">操作</th>
              </Show>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--color-border)]">
            <For each={filtered()} fallback={
              <tr><td colspan="9" class="px-4 py-8 text-center text-[var(--color-text-muted)]">暂无节点</td></tr>
            }>
              {(w) => {
                const s = statusBadge(w.status)
                return (
                  <tr class="hover:bg-[var(--color-muted)]/50">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-xs font-medium text-[var(--color-primary)]">
                          {w.name.charAt(0)}
                        </div>
                        <div>
                          <p class="font-medium text-[var(--color-text-primary)]">{w.name}</p>
                          <p class="text-xs text-[var(--color-text-muted)]">{w.email}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
                        <span class={`w-1.5 h-1.5 rounded-full ${w.status === "healthy" ? "bg-emerald-500" : w.status === "unhealthy" ? "bg-red-500" : "bg-gray-400"}`} />
                        {s.text}
                      </span>
                    </td>
                    <td class={`px-4 py-3 font-mono ${cpuColor(w.metrics?.cpu ?? 0)}`}>
                      {w.metrics?.cpu?.toFixed(1) ?? "-"}%
                    </td>
                    <td class={`px-4 py-3 font-mono ${memColor(w.metrics?.rss ?? 0)}`}>
                      {w.metrics?.rss ?? "-"} MB
                    </td>
                    <td class="px-4 py-3 font-mono">
                      {w.metrics?.sessions ?? "-"}
                    </td>
                    <td class="px-4 py-3 font-mono text-[var(--color-text-secondary)]">
                      {w.metrics ? fmt((w.metrics.tokens.input ?? 0) + (w.metrics.tokens.output ?? 0)) : "-"}
                    </td>
                    <td class="px-4 py-3 text-[var(--color-text-muted)]">{ago(w.started)}</td>
                    <td class="px-4 py-3 text-[var(--color-text-muted)]">{ago(w.active)}</td>
                    <Show when={isAdmin()}>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-1">
                          <Show when={w.status === "healthy" || w.status === "unhealthy"}>
                            <button
                              class="p-1.5 rounded hover:bg-amber-500/10 text-amber-600"
                              title="重启"
                              onClick={() => setConfirm({ uid: w.uid, action: "restart" })}
                            >
                              <RotateCw size={14} />
                            </button>
                            <button
                              class="p-1.5 rounded hover:bg-red-500/10 text-red-600"
                              title="停止"
                              onClick={() => setConfirm({ uid: w.uid, action: "stop" })}
                            >
                              <StopCircle size={14} />
                            </button>
                          </Show>
                        </div>
                      </td>
                    </Show>
                  </tr>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>

      {/* Confirm Dialog */}
      <Show when={confirm()}>
        {(c) => (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div class="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-6 shadow-lg max-w-sm w-full mx-4">
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                确认{c().action === "restart" ? "重启" : "停止"}
              </h3>
              <p class="text-sm text-[var(--color-text-secondary)] mb-4">
                确定要{c().action === "restart" ? "重启" : "停止"}此 Worker 节点吗？{c().action === "stop" ? "停止后用户将无法使用 AI 对话。" : "重启期间用户将短暂中断。"}
              </p>
              <div class="flex justify-end gap-2">
                <button
                  class="px-4 py-2 rounded-[var(--radius-md)] text-sm bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                  onClick={() => setConfirm(null)}
                >
                  取消
                </button>
                <button
                  class={`px-4 py-2 rounded-[var(--radius-md)] text-sm text-white ${c().action === "restart" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}`}
                  onClick={() => act(c().uid, c().action)}
                >
                  {c().action === "restart" ? "重启" : "停止"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/dashboard/src/pages/Workers.tsx
git commit -m "feat(dashboard): add worker management page"
```

---

### Task 11: 注册路由

**Files:**
- Modify: `packages/dashboard/src/app.tsx`

- [ ] **Step 1: 添加 Workers lazy import**

在 `app.tsx` 的 lazy import 区域添加：
```typescript
const Workers = lazy(() => import("./pages/Workers"))
```

- [ ] **Step 2: 添加路由**

在 `<Route path="/admin/models" component={Models} />` 之后添加：
```tsx
<Route path="/admin/workers" component={Workers} />
```

- [ ] **Step 3: 验证类型检查通过**

Run: `cd packages/dashboard && npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 4: 提交**

```bash
git add packages/dashboard/src/app.tsx
git commit -m "feat(dashboard): register /admin/workers route"
```

---

## Chunk 3: Integration Verification

### Task 12: 全量类型检查 + 运行验证

- [ ] **Step 1: Platform typecheck**

Run: `cd packages/platform && bun run typecheck`
Expected: 通过

- [ ] **Step 2: Dashboard typecheck**

Run: `cd packages/dashboard && npx tsc --noEmit`
Expected: 通过

- [ ] **Step 3: Turbo 全局 typecheck**

Run: `bun run typecheck`
Expected: 通过

- [ ] **Step 4: 修复任何类型错误（如有）**

如发现新增类型错误，逐一修复并提交。

- [ ] **Step 5: 最终提交**

如有修复，提交。否则跳过。
