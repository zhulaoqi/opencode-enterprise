# Worker 节点管理 & 角色身份展示

## 概述

为平台增加三项能力：
1. Worker 节点可视化管理页面（指标监控 + 操控）
2. 角色体系增强（描述完善 + 新用户默认角色）
3. 用户身份展示（Sidebar 角色标签 + Settings 角色详情）

## 决策记录

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 监控级别 | B - 中等级 | 系统指标 + 业务指标，无外部依赖 |
| 新用户角色 | A - 默认 developer | 飞书 OAuth 天然组织内，admin 按需调整 |
| Worker 操作权限 | C - admin 全操作，manager 只读 | Worker 是基础设施，操作需谨慎 |
| 整体架构 | 方案一 - 全页面 | Worker 管理需独立空间，不塞 Dashboard |

---

## 模块一：Worker 指标采集与 API

### 数据采集

Worker 进程每 10 秒自采指标写入 Redis。采集逻辑在 `bootstrap.ts` 中用 `setInterval` 实现，不改 OpenCode 核心。

**采集项**：
- `process.cpuUsage()` 换算为 CPU 百分比
- `process.memoryUsage().rss` 和 `.heapUsed` 换算为 MB
- Worker 的 `/session` 列表长度作为会话数
- 从 Platform 审计日志聚合的 token 用量

### Redis 结构

```
worker:{uid}             ← 已有，port/pid/container/secret/started/active，TTL 7200s
worker:metrics:{uid}     ← 新增，cpu/memory/sessions/tokens，TTL 30s
```

`worker:metrics:{uid}` 值：

```json
{
  "cpu": 12.3,
  "rss": 87,
  "heap": 52,
  "sessions": 3,
  "tokens": { "input": 15420, "output": 3210 },
  "ts": 1773985000
}
```

### API 端点

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/admin/workers` | admin, manager | 返回所有 Worker 列表 + 指标 + 用户名 |
| POST | `/api/admin/workers/:uid/restart` | admin | 停止旧 Worker 后重新 spawn |
| POST | `/api/admin/workers/:uid/stop` | admin | 停止 Worker 释放资源 |

**GET `/api/admin/workers` 响应**：

```json
[
  {
    "uid": "b4740526-...",
    "name": "张三",
    "email": "zhangsan@co.com",
    "port": 4212,
    "pid": 53995,
    "status": "healthy",
    "started": 1773985000,
    "active": 1773985900,
    "metrics": {
      "cpu": 12.3,
      "rss": 87,
      "heap": 52,
      "sessions": 3,
      "tokens": { "input": 15420, "output": 3210 }
    }
  }
]
```

`status` 值：`healthy`（健康检查通过）、`unhealthy`（注册存在但健康检查失败）、`offline`（无注册）。

### 实现文件

- `packages/platform/src/worker-manager/bootstrap.ts` — 增加指标采集 setInterval
- `packages/platform/src/worker-manager/metrics.ts` — 新文件，指标读写 Redis
- `packages/platform/src/server/routes/admin.ts` — 新文件，admin API 路由

---

## 模块二：Worker 管理页面

### 路由与权限

- 路径：`/admin/workers`
- Sidebar 入口：「节点管理」，admin 和 manager 可见
- 图标：`Server` (lucide-solid)

### 页面结构

**汇总卡片**（4 个）：在线节点数、离线节点数、总内存使用、总 Token 消耗

**Worker 表格**：

| 列 | 数据源 | 格式 |
|---|---|---|
| 用户 | identity_mapping.name + avatar | 头像 + 姓名 |
| 状态 | healthy / unhealthy / offline | 颜色圆点 + 中文 |
| CPU% | metrics.cpu | 数值，颜色阈值 <50 绿 / 50-80 橙 / >80 红 |
| 内存 | metrics.rss | MB，同上颜色 |
| Token | metrics.tokens.input + output | 格式化为 K 单位 |
| 启动时间 | registry.started | 相对时间 |
| 最近活跃 | registry.active | 相对时间 |
| 操作 | 角色判断 | admin: 重启/停止/启动按钮; manager: 无 |

### 交互

- 10 秒自动刷新 + 手动刷新按钮
- 搜索框按用户名过滤
- 重启/停止操作需二次确认弹窗
- 启动按钮仅对 offline 状态用户显示（触发 /worker/connect 为该用户 spawn）

### 实现文件

- `packages/dashboard/src/pages/Workers.tsx` — 新页面
- `packages/dashboard/src/app.tsx` — 添加路由
- `packages/dashboard/src/components/layout/Sidebar.tsx` — 添加导航项

---

## 模块三：角色体系增强

### 角色描述完善

更新 `role.ts` 的 `seed()` 函数，为每个角色填充 `description`：

| 角色 | 显示名 | 描述 |
|------|--------|------|
| developer | 开发者 | 使用 AI 对话、执行代码任务，适合所有研发人员 |
| finance | 财务 | 在开发者基础上可审批资源申请，适合财务/审批人员 |
| manager | 管理者 | 可查看仪表盘、管理配额、查看节点状态（只读），适合团队负责人 |
| admin | 管理员 | 全部权限，包括用户管理、模型配置、节点操控，适合系统运维人员 |

### 新用户默认角色

飞书 OAuth 登录的 `upsertFromFeishu()` 中，首次创建用户后自动调用 `assignRole(db, uid, developerRoleId)`。

现有 `bootstrap()` 逻辑保留：系统中无 admin 时，首个登录用户获得 admin。

### 实现文件

- `packages/platform/src/rbac/role.ts` — seed 描述 + 新用户 auto-assign
- `packages/platform/src/server/routes/auth.ts` — 登录后 assign developer

---

## 模块四：用户身份展示

### Sidebar 底部

现有结构（Worker 状态 + 用户名）下方增加角色标签：

- 显示用户最高权限角色的中文名
- 角色标签颜色：admin 红、manager 蓝、developer 绿、finance 紫
- 折叠模式不显示标签
- 数据来源：`user()?.roles` 前端已有

### Settings 个人资料

现有的姓名、邮箱下方增加「我的角色」区域：

- 列出用户所有角色，每个带颜色标记 + 描述文字
- 增加部门和职级展示（来自 `/api/auth/me` 已有的 departments + level）
- 角色描述为前端硬编码常量 map

### 角色常量 Map（前端）

```typescript
const ROLES = {
  admin:     { label: "管理员", color: "red",    desc: "全部权限..." },
  manager:   { label: "管理者", color: "blue",   desc: "可查看仪表盘..." },
  finance:   { label: "财务",   color: "purple", desc: "在开发者基础上..." },
  developer: { label: "开发者", color: "green",  desc: "使用 AI 对话..." },
} as const
```

优先级排序：admin > manager > finance > developer。Sidebar 取第一个匹配。

### 实现文件

- `packages/dashboard/src/lib/roles.ts` — 新文件，角色常量 + 工具函数
- `packages/dashboard/src/components/layout/Sidebar.tsx` — 增加角色标签
- `packages/dashboard/src/pages/Settings.tsx` — 增加角色详情区域
- `packages/dashboard/src/stores/auth.ts` — User 类型扩展

---

## 改动文件清单

### 后端 (platform)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/worker-manager/bootstrap.ts` | 修改 | 增加指标采集 setInterval |
| `src/worker-manager/metrics.ts` | 新建 | 指标读写 Redis |
| `src/server/routes/admin.ts` | 新建 | Worker 管理 API |
| `src/server/index.ts` | 修改 | 挂载 admin 路由 |
| `src/rbac/role.ts` | 修改 | seed 描述 + auto-assign |
| `src/server/routes/auth.ts` | 修改 | 新用户分配 developer |

### 前端 (dashboard)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/Workers.tsx` | 新建 | Worker 管理页面 |
| `src/lib/roles.ts` | 新建 | 角色常量 map |
| `src/app.tsx` | 修改 | 添加 /admin/workers 路由 |
| `src/components/layout/Sidebar.tsx` | 修改 | 节点管理入口 + 角色标签 |
| `src/pages/Settings.tsx` | 修改 | 角色详情区域 |
| `src/stores/auth.ts` | 修改 | User 类型扩展 |

---

## 错误处理

- Worker API 失败：返回对应 HTTP 状态码，前端 toast 提示
- 指标采集失败：静默忽略，下次重试
- Worker 重启失败：API 返回 500，前端提示"重启失败，请稍后重试"
- 角色分配失败：登录流程不中断，降级为无角色（无特殊权限）
