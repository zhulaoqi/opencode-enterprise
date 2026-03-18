# OpenCode Enterprise - Frontend Design System & Interaction Specification

> **Status**: Approved
> **Date**: 2026-03-18
> **Stack**: Solid.js + Tailwind CSS + Lucide Icons + ECharts
> **Style**: Data-Dense Dashboard (Enterprise SaaS)

---

## 1. Design Tokens

### 1.1 Color System (Semantic Tokens)

所有颜色使用 CSS 变量定义，组件中禁止使用硬编码 hex 值。

#### Light Mode

```css
:root {
  /* Brand */
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-primary-active: #1E40AF;
  --color-primary-light: #DBEAFE;      /* 用于 badge 背景 */
  --color-on-primary: #FFFFFF;

  /* Secondary */
  --color-secondary: #334155;
  --color-secondary-hover: #1E293B;
  --color-on-secondary: #FFFFFF;

  /* Accent / CTA */
  --color-accent: #F97316;
  --color-accent-hover: #EA580C;
  --color-on-accent: #FFFFFF;

  /* Success / Error / Warning / Info */
  --color-success: #059669;
  --color-success-light: #D1FAE5;
  --color-error: #DC2626;
  --color-error-light: #FEE2E2;
  --color-warning: #D97706;
  --color-warning-light: #FEF3C7;
  --color-info: #0284C7;
  --color-info-light: #E0F2FE;

  /* Surface */
  --color-bg: #F8FAFC;
  --color-bg-elevated: #FFFFFF;
  --color-bg-sunken: #F1F5F9;
  --color-bg-overlay: rgba(0, 0, 0, 0.5);   /* modal scrim */

  /* Text */
  --color-text-primary: #0F172A;        /* 主文本, 对比度 > 7:1 */
  --color-text-secondary: #475569;      /* 副文本, 对比度 > 4.5:1 */
  --color-text-muted: #94A3B8;          /* 辅助/禁用, 对比度 > 3:1 */
  --color-text-inverse: #FFFFFF;

  /* Border */
  --color-border: #E2E8F0;
  --color-border-strong: #CBD5E1;
  --color-border-focus: #2563EB;        /* focus ring */

  /* Card */
  --color-card: #FFFFFF;
  --color-card-hover: #F8FAFC;

  /* Muted (用于 placeholder, disabled) */
  --color-muted: #F1F5FD;
  --color-muted-foreground: #64748B;
}
```

#### Dark Mode

```css
[data-theme="dark"] {
  /* Brand */
  --color-primary: #3B82F6;
  --color-primary-hover: #60A5FA;
  --color-primary-active: #2563EB;
  --color-primary-light: rgba(59, 130, 246, 0.15);
  --color-on-primary: #FFFFFF;

  /* Secondary */
  --color-secondary: #94A3B8;
  --color-secondary-hover: #CBD5E1;
  --color-on-secondary: #0F172A;

  /* Accent */
  --color-accent: #FB923C;
  --color-accent-hover: #F97316;
  --color-on-accent: #0F172A;

  /* Status (降饱和处理) */
  --color-success: #34D399;
  --color-success-light: rgba(52, 211, 153, 0.12);
  --color-error: #F87171;
  --color-error-light: rgba(248, 113, 113, 0.12);
  --color-warning: #FBBF24;
  --color-warning-light: rgba(251, 191, 36, 0.12);
  --color-info: #38BDF8;
  --color-info-light: rgba(56, 189, 248, 0.12);

  /* Surface */
  --color-bg: #0B0F1A;
  --color-bg-elevated: #131928;
  --color-bg-sunken: #060A12;
  --color-bg-overlay: rgba(0, 0, 0, 0.7);

  /* Text */
  --color-text-primary: #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-text-muted: #475569;
  --color-text-inverse: #0F172A;

  /* Border */
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.15);
  --color-border-focus: #3B82F6;

  /* Card */
  --color-card: #131928;
  --color-card-hover: #1A2236;

  /* Muted */
  --color-muted: rgba(255, 255, 255, 0.05);
  --color-muted-foreground: #64748B;
}
```

### 1.2 Typography

| Token | Value | Usage |
|---|---|---|
| `--font-family` | `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif` | 全局 |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | 代码、数据 |
| `--text-xs` | 12px / 1.5 | Badge, 辅助标签 |
| `--text-sm` | 14px / 1.5 | 副文本, 表格内容 |
| `--text-base` | 16px / 1.6 | 正文 (最小可读) |
| `--text-lg` | 18px / 1.5 | 小标题 |
| `--text-xl` | 20px / 1.4 | 卡片标题 |
| `--text-2xl` | 24px / 1.3 | 页面标题 |
| `--text-3xl` | 30px / 1.2 | KPI 数值 |
| `--text-4xl` | 36px / 1.1 | Hero 数字 |
| `--font-normal` | 400 | 正文 |
| `--font-medium` | 500 | 标签, 按钮 |
| `--font-semibold` | 600 | 小标题, 导航高亮 |
| `--font-bold` | 700 | 页面标题, KPI |

### 1.3 Spacing Scale (4px 基础)

```
4px / 8px / 12px / 16px / 20px / 24px / 32px / 40px / 48px / 64px / 80px / 96px
```

Tailwind 映射: `1 / 2 / 3 / 4 / 5 / 6 / 8 / 10 / 12 / 16 / 20 / 24`

### 1.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | 小型内部元素, tag |
| `--radius-md` | 6px | 按钮, 输入框 |
| `--radius-lg` | 8px | 卡片, 面板 |
| `--radius-xl` | 12px | Modal, 大卡片 |
| `--radius-full` | 9999px | Avatar, 药丸形 |

### 1.5 Shadow / Elevation

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04);

/* Dark mode: 用 border 替代 shadow */
[data-theme="dark"] {
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: none;
  --shadow-xl: none;
}
```

### 1.6 Z-Index Scale

| Layer | Value | Usage |
|---|---|---|
| `--z-base` | 0 | 默认内容 |
| `--z-dropdown` | 10 | 下拉菜单 |
| `--z-sticky` | 20 | 固定导航 |
| `--z-overlay` | 40 | 侧面板覆盖 |
| `--z-modal` | 100 | Modal 对话框 |
| `--z-toast` | 1000 | Toast 通知 |

---

## 2. 组件设计规范

### 2.1 按钮 (Button)

**尺寸**:

| Size | Height | Padding | Font |
|---|---|---|---|
| `sm` | 32px | 12px 16px | 13px medium |
| `md` | 40px | 12px 20px | 14px medium |
| `lg` | 48px | 14px 24px | 16px medium |

**变体**:

| Variant | 背景 | 文字 | 边框 | 用途 |
|---|---|---|---|---|
| `primary` | `--color-primary` | `--color-on-primary` | 无 | 主操作 (每屏仅 1 个) |
| `secondary` | `--color-bg-elevated` | `--color-text-primary` | `--color-border` | 次要操作 |
| `ghost` | 透明 | `--color-text-secondary` | 无 | 工具栏操作 |
| `danger` | `--color-error` | 白色 | 无 | 删除/危险操作, 空间上与其他按钮隔离 |
| `accent` | `--color-accent` | `--color-on-accent` | 无 | CTA |

**交互状态**:

```
Default → Hover (背景加深 8%) → Active (scale: 0.98, 背景加深 12%) → Disabled (opacity: 0.5, cursor: not-allowed)
Loading: 文字替换为 Spinner (16px), 按钮禁用防止重复提交
```

**动画**: `transition: all 150ms ease-out`

### 2.2 输入框 (Input)

```
┌────────────────────────────────────────┐
│  Label *                                │   ← 14px semibold, 始终可见
│  ┌──────────────────────────────────┐  │
│  │ 🔍 placeholder text           ▼  │  │   ← 40px 高, 16px 文字, 圆角 6px
│  └──────────────────────────────────┘  │
│  Helper text or error message          │   ← 12px, muted / error 色
└────────────────────────────────────────┘
```

- **Focus**: `border-color: --color-border-focus; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15)`
- **Error**: `border-color: --color-error; Helper text 变红`
- **Disabled**: `background: --color-muted; opacity: 0.6`
- **Validation**: blur 时验证，非每次键入。出错后 auto-focus 到第一个错误字段

### 2.3 卡片 (Card)

```
┌─────────────────────────────────┐  ← border-radius: 8px
│  16px padding                    │  ← shadow-sm (light) / border (dark)
│                                  │
│  内容区域                         │
│                                  │
└─────────────────────────────────┘

Hover: shadow-md + border-color 微调
Clickable 卡片: cursor-pointer + active:scale(0.99)
```

### 2.4 表格 (Table)

```
┌──────┬────────────┬──────────┬──────────┐
│ ▲ ID │  名称       │  状态    │  操作     │  ← 表头: bg-sunken, font-medium, 14px
├──────┼────────────┼──────────┼──────────┤
│ 001  │  张三       │ ● 在线   │ [编辑]   │  ← 行高: 48px, hover: bg-card-hover
│ 002  │  李四       │ ○ 离线   │ [编辑]   │  ← 交替行: 不使用斑马纹, 用 hover 替代
│ 003  │  王五       │ ● 在线   │ [编辑]   │
└──────┴────────────┴──────────┴──────────┘
         ← 1-20 of 342 ▸  页码导航
```

- 排序列带 `aria-sort` 属性
- 移动端 (<768px): 切换为卡片列表或 `overflow-x-auto` 横向滚动
- 50+ 行启用虚拟滚动 (`@tanstack/solid-table` + `virtua`)
- 数字列使用 tabular-nums (等宽数字) 防抖动

### 2.5 Modal / 对话框

```
┌─ ✕ ──────────────────────────────────────┐
│                                           │
│  标题                                     │  ← text-xl, semibold
│  描述文字                                  │  ← text-sm, muted
│                                           │
│  ┌── 内容区 ───────────────────────────┐  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│                                           │
│               [取消]  [确认]              │  ← 右对齐, 危险操作用 danger 色
└───────────────────────────────────────────┘
```

- **入场**: scale(0.95) + opacity(0) → scale(1) + opacity(1), 200ms ease-out
- **退场**: opacity → 0, 150ms (退场比入场快 ~70%)
- **Scrim**: `bg-overlay`, 点击关闭 (含未保存数据时弹确认)
- **ESC 键**: 关闭 (提供逃生路线)
- **Focus trap**: Tab 在 Modal 内循环
- **Max 宽度**: 480px (小) / 640px (中) / 960px (大)
- **移动端**: 底部抽屉 (bottom sheet), 支持下滑关闭

### 2.6 Toast / 通知

```
┌──────────────────────────────────────┐
│  ✓  操作成功                   ✕     │  ← 右上角出现, 3-5s 自动消失
└──────────────────────────────────────┘
```

- 位置: 右上角, 距顶 16px 距右 16px
- 最多同时 3 条, 堆叠间距 8px
- `aria-live="polite"`, 不抢焦点
- 类型: `success` (绿) / `error` (红) / `warning` (黄) / `info` (蓝)
- 进度条: 底部显示剩余时间的渐缩线
- 可撤销操作 (如删除): 显示 "Undo" 按钮

### 2.7 Badge / Tag

```
[● 在线]  [⚠ 降级]  [✕ 离线]  [PUBLIC]  [SHARED]
```

| 类型 | 背景 | 文字 |
|---|---|---|
| success | `--color-success-light` | `--color-success` |
| error | `--color-error-light` | `--color-error` |
| warning | `--color-warning-light` | `--color-warning` |
| info | `--color-info-light` | `--color-info` |
| default | `--color-muted` | `--color-text-secondary` |

高度: 22px, padding: 2px 8px, font: 12px medium, 圆角: 4px

### 2.8 Sidebar 侧边栏

```
┌──────────────────┐
│  ☰ OpenCode      │  ← Logo + 折叠按钮, 高 48px
│──────────────────│
│  ▸ 对话           │  ← 活跃项: bg-primary-light, text-primary, font-semibold
│    MCP 市场       │     左侧 3px 指示条
│    仪表盘         │
│    用户管理        │  ← 仅 admin/manager 可见 (RBAC 控制)
│    配置           │
│    审计日志        │
│──────────────────│
│                   │
│  ▾ 我的空间       │  ← 可折叠分组
│    私有 MCP       │
│    配额           │
│──────────────────│
│  ┌──────────────┐│
│  │ 👤 张三  P6   ││  ← 底部用户信息, avatar + 名字 + 职级
│  │  设置 | 退出  ││
│  └──────────────┘│
└──────────────────┘
```

- 宽度: 展开 240px, 折叠 64px (仅图标)
- 折叠时 hover 图标显示 tooltip
- 移动端: 默认隐藏, 汉堡菜单触发, 滑入 overlay
- 动画: width transition 200ms ease-out
- 项目间距: 4px, 项目高 40px, padding 8px 12px

---

## 3. 页面交互设计

### 3.1 对话页面 (Chat) — 核心体验

#### 布局

```
┌──────────────────┬─────────────────────────────────────────┐
│  会话列表 (280px)  │  对话内容区 (flex: 1)                     │
│                   │                                         │
│  [+ 新对话]       │  ┌─────────────────────────────────────┐│
│  🔍 搜索          │  │          消息流 (滚动区)              ││
│  ────────────    │  │                                     ││
│  [今天]           │  │  用户消息                            ││
│  ▸ 报销查询       │  │  ┌──────────────────────────┐      ││
│    12:30 • 3条    │  │  │ 帮我查一下本月报销进度     │      ││
│  ▸ 代码审查       │  │  └──────────────────────────┘      ││
│    10:15 • 8条    │  │                                     ││
│  ────────────    │  │  AI 响应                             ││
│  [昨天]           │  │  ┌──────────────────────────────┐  ││
│  ○ Jira任务       │  │  │ [思考过程 ▸] (可折叠)         │  ││
│    18:20 • 12条   │  │  │                              │  ││
│                   │  │  │ ┌─ 工具调用卡片 ────────────┐│  ││
│                   │  │  │ │ 🔧 erp.query_expense     ││  ││
│                   │  │  │ │ ⏳ 执行中... 1.2s         ││  ││
│                   │  │  │ │ ▸ 输入参数 (折叠)         ││  ││
│                   │  │  │ │ ▸ 返回结果 (折叠)         ││  ││
│                   │  │  │ └────────────────────────── ┘│  ││
│                   │  │  │                              │  ││
│                   │  │  │ 查询结果:                    │  ││
│                   │  │  │ 您本月报销总额 ¥3,200...     │  ││
│                   │  │  │                              │  ││
│                   │  │  │ [👍] [👎] [📋 复制]          │  ││
│                   │  │  └──────────────────────────────┘  ││
│                   │  │                                     ││
│                   │  └─────────────────────────────────────┘│
│                   │                                         │
│                   │  ┌─ 输入区 ───────────────────────────┐│
│                   │  │ ┌─────────────────────────────┐   ││
│                   │  │ │ 输入消息...                   │   ││
│                   │  │ └─────────────────────────────┘   ││
│                   │  │ 模型: Claude 3.5  配额: 85%  [➤]  ││
│                   │  └────────────────────────────────────┘│
└──────────────────┴─────────────────────────────────────────┘
```

#### 消息气泡交互

**用户消息**:
- 背景: `--color-primary-light` (浅蓝), 圆角 12px
- 右对齐, max-width: 80%
- 长按/右键: 编辑、删除、重新发送

**AI 消息**:
- 背景: `--color-bg-elevated`, 圆角 12px
- 左对齐, max-width: 85%
- 底部操作栏: 复制、反馈(👍👎)、重新生成

**流式输出动画**:
```
文字逐字出现 (typewriter 效果)
  - 每个 token 以 fade-in 出现, 非瞬间跳出
  - 光标闪烁 (animate-pulse) 跟在最后一个字符后
  - 滚动: 自动跟随到底部 (用户手动上滚时暂停自动滚动)
  - 速率: 跟随 LLM 输出速度, 不人为限速
```

**Reasoning (思考过程)**:
```
┌─ 💭 思考中... ──────────────────────┐
│                                      │  ← 默认折叠, 点击展开
│  灰色斜体文字, opacity: 0.7          │
│  动画: 左侧边条脉冲闪烁              │
│                                      │
└──────────────────────────────────────┘
```
- 开始时自动展开显示进度
- 结束后自动折叠, 显示 "思考了 3.2s"
- 点击可重新展开

**工具调用卡片**:
```
┌─────────────────────────────────────┐
│ 🔧 erp.query_expense              │  ← 工具名 + MCP 来源
│ ─────────────────────────────────  │
│ 状态: ⏳ 执行中 / ✅ 成功 / ❌ 失败 │  ← 状态 badge
│ 耗时: 1.2s                         │
│ ▸ 输入参数                         │  ← 点击展开 JSON viewer
│ ▸ 返回结果                         │  ← 点击展开, 支持语法高亮
└─────────────────────────────────────┘
```
- 执行中: 左侧边条 animate-pulse (primary 色)
- 成功: 边条变 success 色, 静止
- 失败: 边条变 error 色, 显示错误信息
- 动画: 卡片从上方 slide-in (translateY: -8px → 0), 200ms

**审批卡片** (人工介入):
```
┌─────────────────────────────────────┐
│  ⚠️ 需要审批                        │
│                                     │
│  操作: 删除生产数据库记录            │
│  发起人: 张三                        │
│  风险等级: 🔴 高                     │
│                                     │
│  [拒绝]          [批准]             │  ← danger + primary 按钮
└─────────────────────────────────────┘
```

#### 输入区交互

```
┌───────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │                                           │ │  ← textarea, 自动增高 (1-5 行)
│ │  输入消息... (Shift+Enter 换行)           │ │
│ │                                           │ │
│ └───────────────────────────────────────────┘ │
│  Claude 3.5 Sonnet ▾  │  配额 85% ███░  │ ➤ │  ← 底部工具栏
└───────────────────────────────────────────────┘
```

- **发送**: Enter 键或点击发送按钮
- **换行**: Shift + Enter
- **模型选择**: 点击模型名弹出下拉, 显示可用模型列表
- **配额指示器**: 进度条, <20% 变 warning 色, <5% 变 error 色
- **发送中**: 发送按钮变为 ■ (停止按钮), 点击取消生成
- **快捷键**: Cmd/Ctrl+K 打开命令面板

#### 会话列表交互

- 点击切换会话, 带 150ms 内容淡入过渡
- 右键菜单: 重命名、删除、导出
- 新消息时未选中的会话闪烁提示
- 当前会话高亮: `bg-primary-light` + 左侧 3px primary 边条
- 拖拽排序 (可选)
- 双击重命名

---

### 3.2 MCP 市场页面

#### 布局

```
┌─────────────────────────────────────────────────────┐
│  MCP 工具市场                      [+ 注册新 MCP]   │
│                                                     │
│  ┌─ 筛选栏 ──────────────────────────────────────┐  │
│  │ [全部] [PUBLIC] [SHARED] [我的]  🔍 搜索...    │  │
│  │ 标签: [研发] [财务] [通用] [运维] ...          │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 卡片网格 (3列, 响应式) ───────────────────────┐  │
│  │                                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │  │
│  │  │ Git      │  │ ERP 系统  │  │ Jira     │    │  │
│  │  │ PUBLIC   │  │ SHARED   │  │ SHARED   │    │  │
│  │  │ ● 健康   │  │ ● 健康   │  │ ⚠ 降级   │    │  │
│  │  │ 5 工具   │  │ 12 工具  │  │ 8 工具   │    │  │
│  │  │ 1.2k/天  │  │ 890/天   │  │ 320/天   │    │  │
│  │  └──────────┘  └──────────┘  └──────────┘    │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

#### MCP 卡片设计

```
┌─────────────────────────────────────┐
│  [图标]  Git Tools                  │  ← 名称 + 描述
│          代码版本控制工具集          │
│                                     │
│  [PUBLIC]  [● 健康]                 │  ← 可见性 badge + 健康状态
│                                     │
│  工具数: 5    今日调用: 1,240       │  ← KPI 数据
│  授权人数: 342   Owner: 管理员      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ git_push, git_pull,         │   │  ← 工具列表预览 (折叠)
│  │ git_commit, git_diff, ...   │   │
│  └─────────────────────────────┘   │
│                                     │
│  [查看详情]  [请求授权/管理]         │  ← 操作按钮
└─────────────────────────────────────┘
```

- 卡片 hover: shadow 升高 + 微上移 (translateY: -2px)
- 健康状态实时更新 (WebSocket 推送)
- SHARED 未授权时: 操作显示 "请求授权", 点击发送请求给 Owner
- 筛选动画: 卡片 fade-in/out, 位置重排 (layout animation)

#### MCP 详情页 (点击卡片进入)

```
┌─────────────────────────────────────────────────────┐
│  ← 返回市场     Git Tools                [编辑]     │
│                                                     │
│  ┌─ 概览 ────────────────────────────────────────┐  │
│  │  类型: local     状态: ● 健康                  │  │
│  │  可见性: PUBLIC  Owner: admin                  │  │
│  │  创建时间: 2026-03-10                          │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 工具列表 ────────────────────────────────────┐  │
│  │  git_push    "推送代码到远程"       [测试]     │  │
│  │  git_pull    "拉取远程代码"         [测试]     │  │
│  │  git_commit  "提交代码变更"         [测试]     │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 授权管理 (仅 Owner/Admin 可见) ──────────────┐  │
│  │  [+ 添加授权]                                  │  │
│  │  张三 (开发) - use    [移除]                   │  │
│  │  研发部 (部门) - use  [移除]                   │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 调用统计 (7天趋势) ──────────────────────────┐  │
│  │  [折线图: 每日调用量 + 平均响应时间]            │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

### 3.3 仪表盘页面 (Dashboard)

#### KPI 卡片区

```
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  总 Token   │  │  总成本     │  │  活跃用户   │  │  平均响应    │
│  2.4M       │  │  ¥8,560    │  │  342        │  │  3.2s       │
│  ↑ 12%      │  │  ↑ 8%      │  │  ↑ 5%       │  │  ↓ 15%      │
│  vs 上月    │  │  vs 上月    │  │  vs 上月     │  │  vs 上月     │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
```

- KPI 数值: `--text-3xl`, `--font-bold`, 使用 tabular-nums
- 趋势指标: ↑ 绿色 (增长), ↓ 红色 (对于成本是负面的则反转)
- 加载中: skeleton 脉冲动画
- 数值变化: 数字滚动动画 (counter animation, 500ms)

#### 图表区

| 图表 | 类型 | 数据 | 交互 |
|---|---|---|---|
| Token 用量趋势 | **折线图** (Line) | 30 天每日 input/output token | Hover tooltip, 可缩放 |
| 部门用量分布 | **柱状图** (Bar) | 各部门月度 token 用量 | 点击下钻到部门详情 |
| MCP 调用 Top10 | **横向柱状图** (Horizontal Bar) | 工具调用次数排行 | Hover 显示具体数值 |
| 成本构成 | **堆叠面积图** (Stacked Area) | 按 Provider 的成本趋势 | 图例点击切换系列 |
| 成功率 | **Gauge** 仪表盘 | 工具调用成功率 | 阈值区间着色 |

**图表通用规范**:
- 配色: 使用 `--color-primary`, `--color-accent`, `--color-success`, `--color-info` 渐变
- Grid 线: `--color-border` (低对比度, 不与数据竞争)
- Tooltip: 白底/暗底卡片, shadow-lg, 圆角 6px
- 图例: 可点击切换, 位于图表上方
- 空数据: 显示 "暂无数据" + 指引文案
- 加载: skeleton shimmer
- 响应式: 小屏时图表堆叠, 自动简化 (减少 tick, 隐藏图例)
- `prefers-reduced-motion`: 禁用入场动画, 数据直接显示

#### 时间范围选择器

```
[今天] [本周] [本月] [本季] [自定义 📅]
```

- 切换时: 图表 fade + 数据刷新 (带 skeleton)
- 自定义: 日期范围选择器 (DateRangePicker)

---

### 3.4 管理页面

#### 用户管理

```
┌──────────────────────────────────────────────────────┐
│  用户管理                     [同步组织架构] [导出]   │
│                                                      │
│  🔍 搜索姓名/工号   [部门 ▾]  [角色 ▾]  [状态 ▾]   │
│                                                      │
│  ┌─ 表格 ────────────────────────────────────────┐  │
│  │ 头像  姓名   工号   部门    角色    状态  操作  │  │
│  │ ──────────────────────────────────────────── │  │
│  │ 🧑  张三  E001  研发部  developer  ● 活跃 [▾]│  │
│  │ 🧑  李四  E002  财务部  finance    ● 活跃 [▾]│  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  显示 1-20 / 共 342 人           ← 1 2 3 ... 18 →  │
└──────────────────────────────────────────────────────┘
```

操作下拉: 编辑角色、调整配额、禁用账户、查看使用记录

#### 配额管理

```
┌──────────────────────────────────────────────────────┐
│  配额管理                                [+ 新增规则] │
│                                                      │
│  ┌─ 树形结构 ────────────────────────────────────┐  │
│  │                                                │  │
│  │  🌐 全局                                       │  │
│  │  ├── 月上限: 100M tokens  ████████░░ 78%      │  │
│  │  │                                             │  │
│  │  ├─ 📁 研发部                                   │  │
│  │  │  ├── 月上限: 50M tokens  ██████░░░ 65%     │  │
│  │  │  ├── 张三: 日上限 50k   ████░░░░ 42%      │  │
│  │  │  └── 李四: 日上限 50k   ██░░░░░░ 23%      │  │
│  │  │                                             │  │
│  │  └─ 📁 财务部                                   │  │
│  │     ├── 月上限: 20M tokens  ████████████ 95%  │  │  ← 接近上限: warning 色
│  │     └── 王五: 日上限 30k   ██████████░ 88%   │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- 进度条颜色: <60% success, 60-80% primary, 80-95% warning, >95% error
- 点击节点: 右侧展开编辑面板 (slide-in)
- 实时更新: WebSocket 推送用量变化

#### 审计日志

```
┌──────────────────────────────────────────────────────┐
│  审计日志                                             │
│                                                      │
│  🔍 搜索  [用户 ▾] [MCP ▾] [状态 ▾] [日期范围 📅]  │
│                                                      │
│  时间线视图:                                          │
│                                                      │
│  ● 14:32:15  张三  调用 erp.query_expense            │
│  │           状态: ✅ 成功  耗时: 1.2s               │
│  │           Token: 1,240 input / 856 output         │
│  │           成本: ¥0.024                             │
│  │                                                   │
│  ● 14:30:08  李四  调用 git.push                     │
│  │           状态: ❌ 权限不足                        │
│  │           原因: 角色 finance 无 git_* 权限         │
│  │                                                   │
│  ● 14:28:55  王五  调用 jira.create_issue            │
│  │           状态: ✅ 成功  耗时: 2.8s               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- 时间线竖线: `--color-border`
- 成功: 绿色圆点, 失败: 红色圆点, 警告: 黄色
- 点击展开: 显示完整 input/output JSON
- 导出: CSV / JSON

---

## 4. 动画与过渡规范

### 4.1 Duration 体系

| 类型 | 时长 | 用途 |
|---|---|---|
| `instant` | 100ms | Hover 状态变化, focus ring |
| `fast` | 150ms | 按钮 active, tooltip 出现 |
| `normal` | 200ms | 面板展开, Modal 入场, 侧栏折叠 |
| `slow` | 300ms | 页面切换过渡, 复杂布局动画 |

### 4.2 Easing

| 名称 | 值 | 用途 |
|---|---|---|
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 进入动画 (元素出现) |
| `ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | 退出动画 (元素消失, 时长为进入的 ~70%) |
| `ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | 状态切换 |

### 4.3 具体动画

| 元素 | 动画 | 规格 |
|---|---|---|
| 页面切换 | Crossfade | opacity 0→1, 200ms ease-out |
| 侧栏折叠/展开 | Width transition | width 240→64px, 200ms ease-out |
| Modal 入场 | Scale + fade | scale(0.95)→1 + opacity, 200ms ease-out |
| Modal 退场 | Fade | opacity 1→0, 150ms ease-in |
| Toast 入场 | Slide + fade | translateX(100%)→0 + opacity, 200ms ease-out |
| Toast 退场 | Fade | opacity 1→0, 150ms ease-in |
| 工具卡片入场 | Slide down | translateY(-8px)→0, 200ms ease-out |
| 卡片 hover | Lift | translateY(0)→(-2px) + shadow 升级, 150ms |
| Skeleton 加载 | Pulse | opacity 0.5↔1, 1.5s infinite |
| 流式文字光标 | Blink | opacity 0↔1, 800ms infinite |
| KPI 数值变化 | Counter | 数字滚动, 500ms ease-out |
| 图表入场 | Progressive | 数据点逐渐出现, 400ms (respect reduced-motion) |

### 4.4 `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- 所有装饰性动画禁用
- 功能性反馈 (loading spinner) 保留但简化
- 页面切换改为即时切换
- KPI counter 直接显示最终值

---

## 5. 响应式设计

### 5.1 断点系统

| 断点 | 宽度 | 布局策略 |
|---|---|---|
| Mobile | < 768px | 单列, 底部导航, 全屏视图 |
| Tablet | 768-1023px | 可折叠侧栏, 两栏 |
| Desktop | 1024-1439px | 固定侧栏, 三栏 |
| Wide | ≥ 1440px | 三栏, max-width: 1440px 居中 |

### 5.2 Mobile 适配 (< 768px)

```
┌──────────────────────────┐
│  OpenCode  🔍  🔔  👤    │  ← 顶栏精简
├──────────────────────────┤
│                          │
│  全屏内容区               │  ← 无侧栏
│  (对话/MCP/仪表盘)       │
│                          │
│                          │
├──────────────────────────┤
│  💬  🛠  📊  👥  ⚙      │  ← 底部 Tab 导航 (≤5项)
└──────────────────────────┘
```

- 对话页: 全屏聊天, 会话列表由顶部抽屉滑出
- MCP 市场: 单列卡片
- 仪表盘: KPI 2x2 网格, 图表堆叠 (每图全宽)
- 表格: 切换为卡片列表视图
- Modal: 变为全屏 bottom sheet

### 5.3 H5 嵌入模式 (飞书内)

```css
/* 检测飞书 UA */
body.feishu-embedded {
  /* 隐藏顶栏 (飞书容器提供) */
  --topbar-height: 0px;
  /* 调整安全区域 */
  padding-bottom: env(safe-area-inset-bottom);
  /* 禁用长按选择 */
  -webkit-touch-callout: none;
}
```

- 自动检测 `Lark` / `Feishu` UA
- 隐藏自有导航 (飞书提供返回/标题)
- 对话页全屏化, 无侧栏
- 支持飞书 JSSDK 调用原生能力

---

## 6. 无障碍 (Accessibility)

### 6.1 必须满足 (WCAG AA)

| 检查项 | 标准 | 实现 |
|---|---|---|
| 文本对比度 | ≥ 4.5:1 (正文), ≥ 3:1 (大文本) | 所有 token 已验证 |
| 焦点指示 | 2-3px solid ring | `focus-visible:ring-2 ring-offset-2` |
| 键盘导航 | Tab 顺序 = 视觉顺序 | `tabIndex` 合理设置 |
| Alt 文本 | 有意义的图片均有 | `<img alt="...">` |
| 标题层级 | h1→h2→h3 不跳级 | 语义化标题 |
| 表单标签 | 每个 input 有 label | `<label>` + `for` |
| 颜色非唯一 | 状态不仅靠颜色表达 | 图标 + 文字 + 颜色 |
| Skip link | 跳过导航到主内容 | 首个 Tab 聚焦 skip link |

### 6.2 ARIA 标注

```html
<!-- 导航 -->
<nav aria-label="主导航">
  <a aria-current="page">对话</a>
</nav>

<!-- Toast -->
<div role="status" aria-live="polite">操作成功</div>

<!-- 错误表单 -->
<input aria-invalid="true" aria-describedby="email-error" />
<span id="email-error" role="alert">请输入有效邮箱</span>

<!-- 排序表格 -->
<th aria-sort="ascending">名称</th>

<!-- Loading -->
<div aria-busy="true" aria-label="加载中">
  <Skeleton />
</div>
```

---

## 7. 图标系统

### 7.1 规范

- **库**: Lucide Icons (24px 默认, 1.5px stroke)
- **禁止**: 使用 emoji 作为功能图标
- **尺寸**: 16px (inline) / 20px (按钮内) / 24px (导航/卡片) / 32px (空状态)
- **颜色**: 继承 `currentColor`, 不单独设色
- **一致性**: 同一层级统一使用 outline 或 filled, 不混用

### 7.2 图标映射

| 功能 | 图标 | Lucide 名称 |
|---|---|---|
| 对话 | 💬 → SVG | `MessageSquare` |
| MCP 市场 | 🛠 → SVG | `Wrench` |
| 仪表盘 | 📊 → SVG | `BarChart3` |
| 用户管理 | 👥 → SVG | `Users` |
| 配置 | ⚙ → SVG | `Settings` |
| 审计日志 | 📋 → SVG | `ClipboardList` |
| 健康-正常 | ● | `CircleCheck` (success 色) |
| 健康-降级 | ⚠ | `AlertTriangle` (warning 色) |
| 健康-离线 | ✕ | `CircleX` (error 色) |
| 发送 | ➤ | `Send` |
| 搜索 | 🔍 → SVG | `Search` |
| 通知 | 🔔 → SVG | `Bell` |
| 折叠 | ← | `PanelLeftClose` |
| 展开 | → | `PanelLeftOpen` |
| 复制 | 📋 | `Copy` |
| 编辑 | ✏️ | `Pencil` |
| 删除 | 🗑 | `Trash2` |
| 刷新 | 🔄 | `RefreshCw` |

---

## 8. 空状态 & 错误状态

### 8.1 空状态

每个列表/区域都需要空状态设计:

```
┌──────────────────────────────────────┐
│                                      │
│          [64px 插图/图标]             │
│                                      │
│        暂无对话记录                   │  ← text-lg, text-secondary
│   开始一个新的对话来使用 AI 助手       │  ← text-sm, text-muted
│                                      │
│          [+ 新建对话]                │  ← 主操作按钮
│                                      │
└──────────────────────────────────────┘
```

### 8.2 错误状态

```
┌──────────────────────────────────────┐
│                                      │
│          [Error 图标, error 色]       │
│                                      │
│        加载失败                       │
│    网络连接异常，请检查后重试          │
│                                      │
│          [重新加载]                   │
│                                      │
└──────────────────────────────────────┘
```

### 8.3 连接状态指示

状态栏 (页面底部):

```
● 已连接    WebSocket 连接正常
⚠ 重连中    正在尝试重新连接... (第 2 次)
✕ 已断开    与服务器的连接已断开 [重新连接]
```

---

## 9. 主题切换

### 9.1 切换方式

- 用户设置: 手动选择 Light / Dark / System
- 默认: 跟随系统 (`prefers-color-scheme`)
- 存储: `localStorage` key `theme`
- 切换动画: 整页 crossfade, 200ms

### 9.2 实现

```typescript
// Solid.js signal
const [theme, setTheme] = createSignal<"light" | "dark" | "system">(
  localStorage.getItem("theme") ?? "system"
)

// 实际应用的主题
const resolved = () => {
  if (theme() === "system")
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  return theme()
}

// 绑定到 document
createEffect(() => {
  document.documentElement.setAttribute("data-theme", resolved())
})
```

---

## 10. Pre-Delivery Checklist

### 视觉质量
- [ ] 所有图标来自 Lucide, 无 emoji 用作功能图标
- [ ] SVG 图标, stroke 一致 (1.5px)
- [ ] 使用语义 CSS 变量, 无硬编码颜色
- [ ] Light/Dark 两套主题均已测试
- [ ] Brand assets 使用正确比例

### 交互
- [ ] 所有可点击元素有 `cursor-pointer`
- [ ] 所有按钮有 hover (150ms) + active (scale 0.98) 反馈
- [ ] 加载按钮禁用 + spinner
- [ ] Disabled 状态: opacity 0.5 + cursor not-allowed
- [ ] 表单验证: blur 触发, 错误紧邻字段, 自动 focus 首个错误

### 动画
- [ ] 微交互: 150-300ms
- [ ] 入场 ease-out, 退场 ease-in (退场更快)
- [ ] Skeleton 用于 > 300ms 的加载
- [ ] `prefers-reduced-motion` 已尊重
- [ ] 无装饰性无限动画

### 响应式
- [ ] 375px (小手机) 已验证
- [ ] 768px (平板) 已验证
- [ ] 1024px (桌面) 已验证
- [ ] 1440px (宽屏) 已验证
- [ ] 横屏模式无异常
- [ ] H5 嵌入 (飞书) 安全区域正确

### 无障碍
- [ ] 文本对比度 ≥ 4.5:1
- [ ] Focus ring 可见 (2-3px)
- [ ] 键盘 Tab 顺序正确
- [ ] ARIA 标注完整 (nav, live region, sort, busy)
- [ ] Skip link 存在
- [ ] 颜色非唯一表达方式

### 数据展示
- [ ] 图表有图例 + Tooltip
- [ ] 图表有空数据 / 错误状态
- [ ] 数字使用 tabular-nums
- [ ] 表格 > 50 行启用虚拟滚动
- [ ] 图表 `prefers-reduced-motion` 时禁用入场动画
