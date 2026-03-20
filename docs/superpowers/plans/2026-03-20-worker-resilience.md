# Worker 容灾加固 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Worker 进程与 Platform 解耦，加入主动健康巡检、自治续命/终结、优雅停机、前端降级提示。

**Architecture:** Worker 改为 detached 独立进程，自己通过 Redis 续命注册；Platform 新增 patrol 巡检循环主动发现异常；优雅停机不杀 Worker；前端区分 502/503/网络错误给出不同提示。

**Tech Stack:** TypeScript, Bun, Hono, Redis (ioredis), SolidJS

---

## File Structure

### New Files
- `packages/platform/src/worker-manager/patrol.ts` — 主动健康巡检

### Modified Files
- `packages/platform/src/worker-manager/manager.ts` — spawnProcess detach + recover 增强
- `packages/platform/src/worker-manager/bootstrap.ts` — 日志写文件 + 自我续命 + 自我终结
- `packages/platform/src/index.ts` — 启动 patrol + 优雅停机
- `packages/dashboard/src/lib/worker.ts` — 区分错误码 + reason signal
- `packages/dashboard/src/pages/Chat.tsx` — overlay 按 reason 展示

---

## Task 1: Worker 进程 detach

**Files:**
- Modify: `packages/platform/src/worker-manager/manager.ts:37-52`

- [ ] **Step 1: 修改 spawnProcess**

将 `stdout: "inherit"`, `stderr: "inherit"` 改为 `stdout: "ignore"`, `stderr: "ignore"`，并在 spawn 后调用 `proc.unref()`。

- [ ] **Step 2: typecheck**

Run: `cd packages/platform && bun run typecheck`

- [ ] **Step 3: 提交**

```bash
git add packages/platform/src/worker-manager/manager.ts
git commit -m "feat(platform): detach worker processes from platform lifecycle"
```

---

## Task 2: bootstrap 自我续命 + 自我终结 + 日志

**Files:**
- Modify: `packages/platform/src/worker-manager/bootstrap.ts`

- [ ] **Step 1: 添加日志写文件**

在 server listen 之后，用 `Bun.file(path.join(dir, "worker.log"))` 打开日志文件，替换 console.log 为写文件的函数。

- [ ] **Step 2: 在 report() 中增加自我续命**

report() 中除了写 metrics 之外，同时刷新 `worker:{uid}` Registry 条目：
- 从环境变量获取 port, pid, secret, started
- 每次 report 时 SET worker:{uid} 续期 TTL 7200

- [ ] **Step 3: 增加自我终结逻辑**

维护 `fails`（Redis 写入失败计数）和 `lastActive`（最后有 session 活动的时间）。
在 report() 末尾检查终止条件：
- fails >= 30 → exit（Redis 不可达 ≈5 分钟）
- Date.now() - lastActive > 7_200_000 → exit（无活动 2 小时）
- Date.now() - started > 86_400_000 → exit（运行超 24 小时）

退出前尝试写 tombstone 到 Redis。

- [ ] **Step 4: typecheck**

Run: `cd packages/platform && bun run typecheck`

- [ ] **Step 5: 提交**

```bash
git add packages/platform/src/worker-manager/bootstrap.ts
git commit -m "feat(platform): worker self-renewal, self-termination, and file logging"
```

---

## Task 3: 主动健康巡检 patrol.ts

**Files:**
- Create: `packages/platform/src/worker-manager/patrol.ts`

- [ ] **Step 1: 创建 patrol.ts**

包含：
- `start()` — 启动 setInterval(check, 30_000)
- `stop()` — clearInterval
- `check()` — 扫描 registry.all()，对每个做 healthy()，连续 3 次失败标记 unhealthy 并自动重启（每小时最多 3 次）

- [ ] **Step 2: typecheck**

Run: `cd packages/platform && bun run typecheck`

- [ ] **Step 3: 提交**

```bash
git add packages/platform/src/worker-manager/patrol.ts
git commit -m "feat(platform): add active worker health patrol"
```

---

## Task 4: Platform 优雅停机 + recover 增强 + 启动 patrol

**Files:**
- Modify: `packages/platform/src/index.ts`
- Modify: `packages/platform/src/worker-manager/manager.ts`

- [ ] **Step 1: index.ts 增加 patrol 启动和信号处理**

导入 patrol，调用 patrol.start()。
注册 SIGTERM/SIGINT 处理器：stop patrol，关闭 redis，process.exit(0)。不杀 Worker。

- [ ] **Step 2: manager.ts recover() 增强**

扫描 `worker:tombstone:*`，记录日志。清理 tombstone。
对不健康的 Worker 尝试 kill PID 清理进程。

- [ ] **Step 3: typecheck**

Run: `cd packages/platform && bun run typecheck`

- [ ] **Step 4: 提交**

```bash
git add packages/platform/src/index.ts packages/platform/src/worker-manager/manager.ts
git commit -m "feat(platform): graceful shutdown + enhanced recovery + patrol startup"
```

---

## Task 5: 前端降级提示

**Files:**
- Modify: `packages/dashboard/src/lib/worker.ts`
- Modify: `packages/dashboard/src/pages/Chat.tsx`

- [ ] **Step 1: worker.ts 增加 reason signal**

新增 `reason` signal：`"none" | "worker_down" | "platform_maintenance" | "platform_unreachable"`。
在 connect() 和 request() 中根据 502/503/网络异常设置不同 reason。

- [ ] **Step 2: Chat.tsx overlay 按 reason 展示**

overlay 中根据 reason() 显示不同文案：
- worker_down: "工作节点异常，正在恢复..."
- platform_maintenance: "平台维护中，请稍候..."
- platform_unreachable: "平台暂不可用，将自动重连"

- [ ] **Step 3: typecheck**

Run: `bun run typecheck`

- [ ] **Step 4: 提交**

```bash
git add packages/dashboard/src/lib/worker.ts packages/dashboard/src/pages/Chat.tsx
git commit -m "feat(dashboard): differentiated error messages for worker/platform failures"
```

---

## Task 6: 全量验证

- [ ] **Step 1: turbo typecheck**

Run: `bun run typecheck`

- [ ] **Step 2: 修复错误（如有）**

- [ ] **Step 3: 最终提交（如有修复）**
