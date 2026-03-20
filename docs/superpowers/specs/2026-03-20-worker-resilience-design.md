# Worker 容灾加固设计

## 概述

解决 Worker 与 Platform 进程耦合过紧、故障传播、孤儿进程无管理三大问题。目标：Platform 崩溃不影响 Worker，Worker 能自治，管理员能看到和控制所有节点。

## 决策记录

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 加固级别 | C - 全面加固 | 覆盖进程解耦、主动监控、优雅停机、孤儿自治、降级策略 |
| 架构方案 | 方案一 - 进程解耦+主动监控 | 改动最小但覆盖所有场景，不引入新组件 |

---

## 模块一：Worker 进程解耦

### 当前问题

Worker 通过 `Bun.spawn` 创建为 Platform 子进程，`stdout: "inherit"` 绑定了 IO。Platform 进程退出时 Worker 可能收到信号或因 IO 管道断裂而退出。

### 改造

修改 `manager.ts` 的 `spawnProcess()`:

- `stdout: "ignore"`, `stderr: "ignore"` — 断开 IO 绑定
- `proc.unref()` — Platform 退出时不等待子进程

Worker 改为独立进程，生命周期不再依赖 Platform。

### Worker 日志

Worker 不再继承 Platform stdout，改为写文件：

- `bootstrap.ts` 启动时打开 `${dir}/worker.log`
- 使用 `Bun.file()` appendable 写日志
- 日志文件在 Worker 数据目录 `.workers/{uid}/worker.log`

### 实现文件

- `packages/platform/src/worker-manager/manager.ts` — spawnProcess 改为 detached

---

## 模块二：Worker 自治

### A. 自我续命

Worker 的 `report()` 函数（每 10 秒执行）扩展：

1. 写 `worker:metrics:{uid}` (已有，TTL 30s)
2. **新增**：刷新 `worker:{uid}` Registry 条目 (TTL 7200s)
   - Worker 从自己的环境变量读取 port/pid/secret 等信息
   - 每次 report 时 SET 续期
   - 只要 Worker 活着 + Redis 可达，Registry 不会过期

### B. 自我终结

Worker 不能无限游离，定义三个终止条件：

| 条件 | 阈值 | 说明 |
|------|------|------|
| Redis 连续不可达 | 30 次（≈5 分钟） | Redis 挂了无法被管理 |
| 无用户活动 | 2 小时 | 没人用不该占资源 |
| 进程最长运行时间 | 24 小时 | 防止内存泄漏等长期问题 |

实现方式：

- `bootstrap.ts` 维护 `fails` 计数器（Redis 写入失败 +1，成功归零）
- `bootstrap.ts` 维护 `lastActive` 时间戳（通过查询本地 `/session` 列表是否有活动判断，或追踪 HTTP 请求）
- 满足任一终止条件时：
  1. 尝试写入 `worker:tombstone:{uid}`（JSON: `{ reason, ts }`，TTL 3600s）
  2. `process.exit(0)` 干净退出

### C. Tombstone

```
worker:tombstone:{uid}  TTL 3600s
{
  "reason": "idle" | "redis_unreachable" | "max_uptime",
  "ts": 1773985000
}
```

供 Platform `recover()` 和管理页面读取，了解 Worker 为何终止。

### 实现文件

- `packages/platform/src/worker-manager/bootstrap.ts` — 自我续命 + 自我终结逻辑

---

## 模块三：Platform 主动健康巡检

### 巡检循环

新建 `patrol.ts`，Platform 启动时 `patrol.start()`:

```
每 30 秒:
  1. redis.keys("worker:*") 排除 _port 和 metrics 和 tombstone
  2. 对每个条目 healthy(port)
  3. 连续 3 次不健康 → 标记 unhealthy
  4. unhealthy 且本小时重启次数 < 3 → 自动重启（stop + spawn）
  5. 重启失败 → 清理 Redis 条目，写 tombstone
  6. 重启成功 → 重置失败计数
```

### 参数

| 参数 | 值 | 说明 |
|------|------|------|
| PATROL_INTERVAL | 30s | 巡检间隔 |
| UNHEALTHY_THRESHOLD | 3 | 连续不健康次数触发重启 |
| MAX_RESTARTS_PER_HOUR | 3 | 同一 Worker 每小时最多自动重启次数 |

### 状态追踪

`patrol.ts` 内部维护 `Map<string, { fails: number; restarts: number; hour: number }>`:
- `fails`: 连续健康检查失败次数，healthy 时归零
- `restarts`: 当前小时内重启次数
- `hour`: 记录的小时标记，跨小时重置

### 实现文件

- `packages/platform/src/worker-manager/patrol.ts` — 新建
- `packages/platform/src/index.ts` — 启动 patrol

---

## 模块四：Platform 优雅停机

### SIGTERM/SIGINT 处理

在 `index.ts` 注册信号处理器：

1. 标记 `shutting = true`
2. 停止 patrol 巡检
3. 等待进行中的请求完成（最多 10s）
4. 关闭 Redis 连接
5. **不杀 Worker**（它们是独立进程，自己续命）
6. `process.exit(0)`

关键设计决定：Platform 停机时不停止 Worker。Worker 靠自治机制维持，等 Platform 恢复后被 `recover()` 纳管。

### recover() 增强

Platform 启动时 `recover()` 增加：

1. 原有逻辑：扫描 `worker:*`，健康的复用，不健康的清理
2. **新增**：扫描 `worker:tombstone:*`，记录日志告知哪些 Worker 在 Platform 不在时自我终止了
3. **新增**：清理过期 tombstone（虽然有 TTL，但主动清理更干净）

### 实现文件

- `packages/platform/src/index.ts` — 信号处理器
- `packages/platform/src/worker-manager/manager.ts` — recover() 增强

---

## 模块五：Dashboard 降级提示

### 区分错误类型

修改 `worker.ts` 的 `connect()` 和 `request()`，根据响应状态设置不同提示：

| 响应 | 含义 | 前端提示 |
|------|------|----------|
| 502 | Worker 不可达 | "工作节点异常，正在恢复..." |
| 503 | Platform 维护/Worker 启动中 | "平台维护中，请稍候..." |
| fetch 异常 | Platform 完全不可达 | "平台暂不可用，将自动重连" |

### 新增 signal

`worker.ts` 新增 `reason` signal:

```typescript
type Reason = "none" | "worker_down" | "platform_maintenance" | "platform_unreachable"
```

`Chat.tsx` overlay 根据 `reason()` 显示对应中文提示。

### 实现文件

- `packages/dashboard/src/lib/worker.ts` — 区分错误码，新增 reason signal
- `packages/dashboard/src/pages/Chat.tsx` — overlay 展示不同提示

---

## 改动文件清单

### 后端 (platform)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/worker-manager/manager.ts` | 修改 | spawnProcess detach + recover 增强 |
| `src/worker-manager/bootstrap.ts` | 修改 | 日志写文件 + 自我续命 + 自我终结 |
| `src/worker-manager/patrol.ts` | 新建 | 主动健康巡检 |
| `src/index.ts` | 修改 | 启动 patrol + 优雅停机 |

### 前端 (dashboard)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/worker.ts` | 修改 | 区分错误码 + reason signal |
| `src/pages/Chat.tsx` | 修改 | overlay 按 reason 展示 |

---

## 故障场景覆盖矩阵

| 场景 | 后端行为 | 前端行为 | 恢复方式 |
|------|----------|----------|----------|
| Platform 崩溃 | Workers 继续运行，自我续命 | "平台暂不可用" → 自动重连 | Platform 重启 → recover 纳管 |
| Platform 重启 | recover() 发现存活 Worker | 自动重连成功 | 无感恢复 |
| Worker 静默死亡 | patrol 检测 → 自动重启 | 短暂中断 → 自动恢复 | patrol 自动处理 |
| Redis 不可达 | patrol 暂停；Worker 5 分钟后自终止 | 取决于 Platform 是否可达 | Redis 恢复 + Worker 按需 spawn |
| Worker 无人使用 | 2 小时后自终止，写 tombstone | 下次登录按需 spawn | 按需恢复 |
| Worker 超长运行 | 24 小时后自终止，写 tombstone | 下次请求按需 spawn | 按需恢复 |
| 管理员手动停止 | stop Worker | 用户断连 → 重连触发 spawn | 自动恢复 |
