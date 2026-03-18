# P2b: Frontend Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the enterprise Web Dashboard using Solid.js. Includes chat interface with streaming, MCP marketplace, analytics dashboard, user/quota management, and audit log viewer. Follows the design system from `docs/superpowers/specs/2026-03-18-frontend-design-system.md`.

**Architecture:** Solid.js SPA with Solid Router. WebSocket for real-time chat streaming. REST API for CRUD. CSS variables for theming (light/dark). ECharts for data visualization.

**Tech Stack:** Solid.js, Solid Router, Tailwind CSS, Vite, ECharts, Lucide-solid, @tanstack/solid-table

**Depends on:** P0 (API Server), P1a (MCP routes), P1b (Billing/Dashboard routes), P2a (WebSocket)

**Design Reference:** `docs/superpowers/specs/2026-03-18-frontend-design-system.md`

---

## File Structure

```
packages/dashboard/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── tailwind.config.ts
├── src/
│   ├── index.tsx                    # App entry point
│   ├── app.tsx                      # Root App component (router, providers)
│   ├── styles/
│   │   ├── global.css               # CSS variables (design tokens), Tailwind imports
│   │   └── themes.css               # Light/dark theme tokens
│   ├── lib/
│   │   ├── api.ts                   # REST API client (fetch wrapper)
│   │   ├── ws.ts                    # WebSocket client (connect, reconnect, events)
│   │   ├── auth.ts                  # JWT storage, refresh, logout
│   │   └── format.ts               # Number/date formatters
│   ├── stores/
│   │   ├── auth.ts                  # Auth state (user, token, isLoggedIn)
│   │   ├── chat.ts                  # Chat state (sessions, messages, streaming)
│   │   ├── mcp.ts                   # MCP state (market list, detail)
│   │   ├── theme.ts                 # Theme state (light/dark/system)
│   │   └── notification.ts          # Toast notification state
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   ├── Layout.tsx           # Main layout (sidebar + topbar + content)
│   │   │   └── MobileNav.tsx        # Bottom tab navigation
│   │   ├── chat/
│   │   │   ├── SessionList.tsx      # Left panel session list
│   │   │   ├── MessageBubble.tsx    # User/AI message bubble
│   │   │   ├── ToolCallCard.tsx     # Tool execution card (expandable)
│   │   │   ├── ReasoningBlock.tsx   # Collapsible reasoning section
│   │   │   ├── ApprovalCard.tsx     # Human-in-the-loop approval
│   │   │   ├── ChatInput.tsx        # Message input with model selector
│   │   │   ├── StreamingCursor.tsx  # Blinking cursor for typewriter
│   │   │   └── MessageList.tsx      # Scrollable message list
│   │   ├── mcp/
│   │   │   ├── McpCard.tsx          # MCP market card
│   │   │   ├── McpDetail.tsx        # MCP detail view
│   │   │   ├── McpFilter.tsx        # Visibility/tag filter bar
│   │   │   └── AuthorizationPanel.tsx
│   │   ├── dashboard/
│   │   │   ├── KpiCard.tsx          # KPI stat card with trend
│   │   │   ├── TokenChart.tsx       # Token usage trend (line)
│   │   │   ├── DeptChart.tsx        # Department usage (bar)
│   │   │   ├── ToolRanking.tsx      # Top tools table
│   │   │   └── TimeRangeSelector.tsx
│   │   └── admin/
│   │       ├── UserTable.tsx
│   │       ├── QuotaTree.tsx
│   │       ├── AuditTimeline.tsx
│   │       └── RoleEditor.tsx
│   └── pages/
│       ├── Login.tsx
│       ├── Chat.tsx
│       ├── McpMarket.tsx
│       ├── McpDetail.tsx
│       ├── Dashboard.tsx
│       ├── Users.tsx
│       ├── Quotas.tsx
│       ├── Audit.tsx
│       ├── Settings.tsx
│       └── NotFound.tsx
```

---

## Chunk 1: Project Scaffold & Design Tokens

### Task 1: Create Dashboard Package

**Files:**
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/vite.config.ts`
- Create: `packages/dashboard/index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@opencode-ai/dashboard",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "bun x tsgo --noEmit"
  },
  "dependencies": {
    "solid-js": "catalog:",
    "@solidjs/router": "catalog:",
    "echarts": "5.6.0",
    "echarts-solid": "0.3.0",
    "lucide-solid": "0.469.0",
    "marked": "catalog:",
    "shiki": "catalog:"
  },
  "devDependencies": {
    "vite": "catalog:",
    "vite-plugin-solid": "catalog:",
    "tailwindcss": "catalog:",
    "@tailwindcss/vite": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    port: 3200,
    proxy: {
      "/api": { target: "http://localhost:3100", changeOrigin: true },
      "/ws": { target: "ws://localhost:3100", ws: true },
    },
  },
})
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenCode Enterprise</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "strict": true,
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Update root workspaces, install deps**

Add `"packages/dashboard"` to root `package.json` workspaces.
Run: `bun install`

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/package.json packages/dashboard/tsconfig.json packages/dashboard/vite.config.ts packages/dashboard/index.html package.json bun.lock
git commit -m "feat(dashboard): scaffold Solid.js dashboard package"
```

---

### Task 2: Design Tokens & Global Styles

**Files:**
- Create: `packages/dashboard/src/styles/global.css`
- Create: `packages/dashboard/src/styles/themes.css`

- [ ] **Step 1: Write CSS tokens**

`global.css`:
```css
@import "tailwindcss";
@import "./themes.css";

body {
  font-family: var(--font-family);
  background: var(--color-bg);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

.tabular-nums { font-variant-numeric: tabular-nums; }
```

`themes.css` — copy the complete CSS variable sets from the design system spec (Section 1.1 Light Mode + Dark Mode).

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/styles/
git commit -m "feat(dashboard): add design token CSS variables (light + dark themes)"
```

---

### Task 3: Entry Point & Router

**Files:**
- Create: `packages/dashboard/src/index.tsx`
- Create: `packages/dashboard/src/app.tsx`

- [ ] **Step 1: Write entry point**

```tsx
// index.tsx
import { render } from "solid-js/web"
import { App } from "./app"
import "./styles/global.css"

render(() => <App />, document.getElementById("root")!)
```

- [ ] **Step 2: Write app with router**

```tsx
// app.tsx
import { Router, Route } from "@solidjs/router"
import { Layout } from "./components/layout/Layout"
import { Login } from "./pages/Login"
import { Chat } from "./pages/Chat"
import { McpMarket } from "./pages/McpMarket"
import { Dashboard } from "./pages/Dashboard"
import { Users } from "./pages/Users"
import { Quotas } from "./pages/Quotas"
import { Audit } from "./pages/Audit"
import { Settings } from "./pages/Settings"
import { NotFound } from "./pages/NotFound"
import { ThemeProvider } from "./stores/theme"
import { AuthGuard } from "./lib/auth"

export function App() {
  return (
    <ThemeProvider>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/" component={AuthGuard}>
          <Route path="/" component={Layout}>
            <Route path="/" component={Chat} />
            <Route path="/chat/:id?" component={Chat} />
            <Route path="/mcp" component={McpMarket} />
            <Route path="/mcp/:id" component={McpDetail} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/users" component={Users} />
            <Route path="/quotas" component={Quotas} />
            <Route path="/audit" component={Audit} />
            <Route path="/settings" component={Settings} />
          </Route>
        </Route>
        <Route path="*" component={NotFound} />
      </Router>
    </ThemeProvider>
  )
}

function McpDetail() { return <div>MCP Detail</div> }
```

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/index.tsx packages/dashboard/src/app.tsx
git commit -m "feat(dashboard): add app entry point and route structure"
```

---

## Chunk 2: Core Libraries & Stores

### Task 4: API Client & Auth

**Files:**
- Create: `packages/dashboard/src/lib/api.ts`
- Create: `packages/dashboard/src/lib/auth.ts`
- Create: `packages/dashboard/src/lib/ws.ts`
- Create: `packages/dashboard/src/stores/auth.ts`

- [ ] **Step 1: Write API client**

```typescript
// lib/api.ts
import { token } from "../stores/auth"

const BASE = "/api/v1"

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const tk = token()
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
      ...opts?.headers,
    },
  })
  if (res.status === 401) {
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
```

- [ ] **Step 2: Write auth store**

```typescript
// stores/auth.ts
import { createSignal } from "solid-js"

const [_token, setToken] = createSignal(localStorage.getItem("token") ?? "")
const [user, setUser] = createSignal<any>(null)

export function token() { return _token() }

export function login(tk: string, u: any) {
  localStorage.setItem("token", tk)
  setToken(tk)
  setUser(u)
}

export function logout() {
  localStorage.removeItem("token")
  setToken("")
  setUser(null)
  window.location.href = "/login"
}

export function isLoggedIn() { return !!_token() }
export { user }
```

- [ ] **Step 3: Write WebSocket client**

```typescript
// lib/ws.ts
import { createSignal } from "solid-js"
import { token } from "../stores/auth"

type WsMsg = Record<string, any>
type Handler = (msg: WsMsg) => void

const handlers = new Map<string, Set<Handler>>()
let socket: WebSocket | null = null
let retries = 0
const MAX_RETRIES = 10

const [connected, setConnected] = createSignal(false)
const [reconnecting, setReconnecting] = createSignal(false)

export { connected, reconnecting }

export function connect() {
  const tk = token()
  if (!tk) return

  const protocol = location.protocol === "https:" ? "wss:" : "ws:"
  socket = new WebSocket(`${protocol}//${location.host}/ws?token=${tk}`)

  socket.onopen = () => {
    setConnected(true)
    setReconnecting(false)
    retries = 0
    startPing()
  }

  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    const fns = handlers.get(msg.type)
    if (fns) for (const fn of fns) fn(msg)
  }

  socket.onclose = () => {
    setConnected(false)
    stopPing()
    if (retries < MAX_RETRIES) {
      setReconnecting(true)
      const delay = Math.min(1000 * Math.pow(2, retries), 30000)
      retries++
      setTimeout(connect, delay)
    }
  }

  socket.onerror = () => socket?.close()
}

export function send(msg: WsMsg) {
  socket?.send(JSON.stringify(msg))
}

export function on(type: string, fn: Handler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set())
  handlers.get(type)!.add(fn)
  return () => handlers.get(type)?.delete(fn)
}

let pingTimer: ReturnType<typeof setInterval>
function startPing() { pingTimer = setInterval(() => send({ type: "ping" }), 30000) }
function stopPing() { clearInterval(pingTimer) }

export function disconnect() {
  stopPing()
  socket?.close()
  socket = null
}
```

- [ ] **Step 4: Write auth guard**

```typescript
// lib/auth.ts (add AuthGuard component)
import { type ParentComponent, Show } from "solid-js"
import { Navigate } from "@solidjs/router"
import { isLoggedIn } from "../stores/auth"

export const AuthGuard: ParentComponent = (props) => {
  return (
    <Show when={isLoggedIn()} fallback={<Navigate href="/login" />}>
      {props.children}
    </Show>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/lib/ packages/dashboard/src/stores/auth.ts
git commit -m "feat(dashboard): add API client, WebSocket client, auth store and guard"
```

---

### Task 5: Theme Store & Notification Store

**Files:**
- Create: `packages/dashboard/src/stores/theme.ts`
- Create: `packages/dashboard/src/stores/notification.ts`

- [ ] **Step 1: Write theme store**

```typescript
// stores/theme.ts
import { createSignal, createEffect, type ParentComponent } from "solid-js"

type Theme = "light" | "dark" | "system"

const [theme, setTheme] = createSignal<Theme>(
  (localStorage.getItem("theme") as Theme) ?? "system"
)

function resolved() {
  if (theme() === "system")
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  return theme()
}

export const ThemeProvider: ParentComponent = (props) => {
  createEffect(() => {
    const t = resolved()
    document.documentElement.setAttribute("data-theme", t)
    localStorage.setItem("theme", theme())
  })
  return <>{props.children}</>
}

export { theme, setTheme, resolved }
```

- [ ] **Step 2: Write notification store**

```typescript
// stores/notification.ts
import { createSignal } from "solid-js"

export type Toast = {
  id: string
  type: "success" | "error" | "warning" | "info"
  message: string
  duration?: number
}

const [toasts, setToasts] = createSignal<Toast[]>([])

export { toasts }

export function notify(type: Toast["type"], message: string, duration = 4000) {
  const id = Math.random().toString(36).slice(2)
  setToasts(prev => [...prev.slice(-2), { id, type, message, duration }])
  if (duration > 0) setTimeout(() => dismiss(id), duration)
}

export function dismiss(id: string) {
  setToasts(prev => prev.filter(t => t.id !== id))
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/stores/theme.ts packages/dashboard/src/stores/notification.ts
git commit -m "feat(dashboard): add theme and notification stores"
```

---

## Chunk 3: UI Components

### Task 6: Base UI Components

**Files:**
- Create: `packages/dashboard/src/components/ui/Button.tsx`
- Create: `packages/dashboard/src/components/ui/Input.tsx`
- Create: `packages/dashboard/src/components/ui/Card.tsx`
- Create: `packages/dashboard/src/components/ui/Badge.tsx`
- Create: `packages/dashboard/src/components/ui/Skeleton.tsx`
- Create: `packages/dashboard/src/components/ui/Modal.tsx`
- Create: `packages/dashboard/src/components/ui/Toast.tsx`

- [ ] **Step 1: Write Button**

Follow design spec Section 2.1: 5 variants (primary/secondary/ghost/danger/accent), 3 sizes (sm/md/lg), loading state with spinner, disabled opacity 0.5, transition 150ms, active scale(0.98).

- [ ] **Step 2: Write Input**

Follow design spec Section 2.2: label always visible, focus ring with box-shadow, error state red border, helper text, blur validation.

- [ ] **Step 3: Write Card**

Follow design spec Section 2.3: border-radius 8px, shadow-sm (light) / border (dark), hover shadow-md, clickable variant with cursor-pointer + active scale(0.99).

- [ ] **Step 4: Write Badge**

Follow design spec Section 2.7: success/error/warning/info/default variants, 22px height, padding 2px 8px, 12px font.

- [ ] **Step 5: Write Skeleton**

Animate-pulse rectangle, configurable width/height/rounded.

- [ ] **Step 6: Write Modal**

Follow design spec Section 2.5: scale+fade entrance 200ms, fade exit 150ms, scrim overlay, ESC close, focus trap, 3 size variants.

- [ ] **Step 7: Write Toast container**

Follow design spec Section 2.6: right-top positioned, max 3 stacked, slide-in from right, auto-dismiss progress bar, aria-live="polite".

- [ ] **Step 8: Commit**

```bash
git add packages/dashboard/src/components/ui/
git commit -m "feat(dashboard): add base UI components (Button, Input, Card, Badge, Skeleton, Modal, Toast)"
```

---

### Task 7: Layout Components

**Files:**
- Create: `packages/dashboard/src/components/layout/Sidebar.tsx`
- Create: `packages/dashboard/src/components/layout/Topbar.tsx`
- Create: `packages/dashboard/src/components/layout/Layout.tsx`
- Create: `packages/dashboard/src/components/layout/MobileNav.tsx`

- [ ] **Step 1: Write Sidebar**

Follow design spec Section 2.8: 240px expanded / 64px collapsed, Lucide icons, active item highlight with left border, collapsible groups, user info at bottom, collapse animation 200ms.

- [ ] **Step 2: Write Topbar**

Search bar, notification bell (with count badge), user avatar dropdown (settings, logout), theme toggle.

- [ ] **Step 3: Write Layout**

Compose Sidebar + Topbar + main content `<Outlet />`. Status bar at bottom (connection state, quota %, version).

- [ ] **Step 4: Write MobileNav**

Bottom tab bar with 5 items (Chat, MCP, Dashboard, Users, Settings), icons + labels, active indicator.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/layout/
git commit -m "feat(dashboard): add layout components (Sidebar, Topbar, Layout, MobileNav)"
```

---

## Chunk 4: Chat Page

### Task 8: Chat Components

**Files:**
- Create: `packages/dashboard/src/components/chat/SessionList.tsx`
- Create: `packages/dashboard/src/components/chat/MessageBubble.tsx`
- Create: `packages/dashboard/src/components/chat/ToolCallCard.tsx`
- Create: `packages/dashboard/src/components/chat/ReasoningBlock.tsx`
- Create: `packages/dashboard/src/components/chat/ChatInput.tsx`
- Create: `packages/dashboard/src/components/chat/StreamingCursor.tsx`
- Create: `packages/dashboard/src/components/chat/MessageList.tsx`
- Create: `packages/dashboard/src/stores/chat.ts`
- Create: `packages/dashboard/src/pages/Chat.tsx`

- [ ] **Step 1: Write chat store**

```typescript
// stores/chat.ts
import { createSignal, createResource } from "solid-js"
import { api } from "../lib/api"
import { on as wsOn, send as wsSend } from "../lib/ws"

const [sessions, setSessions] = createSignal<any[]>([])
const [activeId, setActiveId] = createSignal("")
const [messages, setMessages] = createSignal<any[]>([])
const [streaming, setStreaming] = createSignal("")
const [isStreaming, setIsStreaming] = createSignal(false)

export { sessions, activeId, messages, streaming, isStreaming }

export async function loadSessions() {
  const data = await api.get<{ sessions: any[] }>("/sessions")
  setSessions(data.sessions)
}

export async function loadMessages(id: string) {
  setActiveId(id)
  const data = await api.get<{ messages: any[] }>(`/sessions/${id}`)
  setMessages(data.messages)
}

export function sendMessage(text: string) {
  setIsStreaming(true)
  setStreaming("")
  wsSend({ type: "chat", session_id: activeId(), message: text })
}

export function cancelStream() {
  wsSend({ type: "cancel", session_id: activeId() })
  setIsStreaming(false)
}

// Wire WebSocket events
wsOn("text_delta", (msg) => {
  setStreaming(prev => prev + msg.content)
})

wsOn("done", (msg) => {
  setIsStreaming(false)
  setMessages(prev => [...prev, { role: "assistant", content: { text: streaming() }, ...msg.usage }])
  setStreaming("")
})

wsOn("tool_call", (msg) => {
  setMessages(prev => [...prev, { role: "tool", ...msg }])
})

wsOn("error", (msg) => {
  setIsStreaming(false)
  setStreaming("")
})
```

- [ ] **Step 2: Write SessionList**

Left panel: search, grouped by date (today/yesterday/older), active highlight, right-click context menu (rename, delete, export). New session button at top.

- [ ] **Step 3: Write MessageBubble**

User messages: right-aligned, primary-light background. AI messages: left-aligned, elevated background. Markdown rendering with syntax highlighting. Copy button, feedback buttons (thumbs up/down).

- [ ] **Step 4: Write ToolCallCard**

Expandable card per design spec Section 3.1: tool name, MCP source, status badge (executing/success/error), duration, expandable input/output JSON viewer. Left border animation pulse while executing.

- [ ] **Step 5: Write ReasoningBlock**

Collapsible section: auto-expand while streaming, auto-collapse on complete. Shows "Thought for 3.2s". Italic gray text, left border accent.

- [ ] **Step 6: Write ChatInput**

Textarea auto-height (1-5 rows), Enter to send / Shift+Enter newline, model selector dropdown, quota indicator progress bar, send/stop button toggle.

- [ ] **Step 7: Write StreamingCursor**

Blinking cursor (animate-pulse, 800ms) appended after streaming text.

- [ ] **Step 8: Write MessageList**

Virtual scrollable list, auto-scroll to bottom on new messages (pause when user scrolls up), load older messages on scroll to top.

- [ ] **Step 9: Write Chat page**

Compose: SessionList (left 280px) + MessageList + ChatInput (right flex-1). Mobile: full screen chat, session list as drawer.

- [ ] **Step 10: Commit**

```bash
git add packages/dashboard/src/components/chat/ packages/dashboard/src/stores/chat.ts packages/dashboard/src/pages/Chat.tsx
git commit -m "feat(dashboard): add chat page with streaming, tool cards, reasoning blocks"
```

---

## Chunk 5: MCP Market & Dashboard Pages

### Task 9: MCP Market Page

**Files:**
- Create: `packages/dashboard/src/components/mcp/McpCard.tsx`
- Create: `packages/dashboard/src/components/mcp/McpFilter.tsx`
- Create: `packages/dashboard/src/stores/mcp.ts`
- Create: `packages/dashboard/src/pages/McpMarket.tsx`
- Create: `packages/dashboard/src/pages/McpDetail.tsx`

- [ ] **Step 1: Write MCP store**

Fetches from `/api/v1/mcp/market`, supports filtering by visibility/tags.

- [ ] **Step 2: Write McpCard**

Per design spec Section 3.2: icon, name, description, visibility badge, health badge, tool count, daily usage, action buttons. Hover: shadow lift + translateY(-2px).

- [ ] **Step 3: Write McpFilter**

Tabs (All/PUBLIC/SHARED/Mine) + tag pills + search input. Filter animation: cards fade-in/out.

- [ ] **Step 4: Write McpMarket page**

Filter bar + card grid (3 columns desktop, 2 tablet, 1 mobile). Register new MCP button (admin only).

- [ ] **Step 5: Write McpDetail page**

Overview section, tool list with test button, authorization panel (owner/admin only), usage chart (7-day trend).

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/mcp/ packages/dashboard/src/stores/mcp.ts packages/dashboard/src/pages/McpMarket.tsx packages/dashboard/src/pages/McpDetail.tsx
git commit -m "feat(dashboard): add MCP marketplace page with card grid and detail view"
```

---

### Task 10: Analytics Dashboard Page

**Files:**
- Create: `packages/dashboard/src/components/dashboard/KpiCard.tsx`
- Create: `packages/dashboard/src/components/dashboard/TokenChart.tsx`
- Create: `packages/dashboard/src/components/dashboard/DeptChart.tsx`
- Create: `packages/dashboard/src/components/dashboard/ToolRanking.tsx`
- Create: `packages/dashboard/src/components/dashboard/TimeRangeSelector.tsx`
- Create: `packages/dashboard/src/pages/Dashboard.tsx`

- [ ] **Step 1: Write KpiCard**

Per design spec Section 3.3: large number (text-3xl bold tabular-nums), trend arrow with percentage, counter animation on value change (500ms).

- [ ] **Step 2: Write TokenChart (ECharts)**

Line chart: 30-day trend of input/output tokens. Dual Y-axis optional. Tooltip on hover. Responsive.

- [ ] **Step 3: Write DeptChart**

Horizontal bar chart: department token usage ranked. Click to drill into department detail.

- [ ] **Step 4: Write ToolRanking**

Table: tool name, MCP source, call count, avg duration, success rate. Sortable columns.

- [ ] **Step 5: Write TimeRangeSelector**

Button group: Today / This Week / This Month / This Quarter / Custom DateRange.

- [ ] **Step 6: Write Dashboard page**

Compose: 4 KPI cards (row) + TokenChart (full width) + DeptChart (left 50%) + ToolRanking (right 50%). Time range selector at top.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/components/dashboard/ packages/dashboard/src/pages/Dashboard.tsx
git commit -m "feat(dashboard): add analytics dashboard with KPI cards and ECharts"
```

---

## Chunk 6: Admin Pages & Final Integration

### Task 11: Admin Pages

**Files:**
- Create: `packages/dashboard/src/pages/Users.tsx`
- Create: `packages/dashboard/src/pages/Quotas.tsx`
- Create: `packages/dashboard/src/pages/Audit.tsx`
- Create: `packages/dashboard/src/pages/Settings.tsx`
- Create: `packages/dashboard/src/pages/Login.tsx`
- Create: `packages/dashboard/src/pages/NotFound.tsx`

- [ ] **Step 1: Write Users page**

Table with search/filter. Columns: avatar, name, employee ID, department, role, status, actions dropdown. Pagination.

- [ ] **Step 2: Write Quotas page**

Tree view: Global → Departments → Users. Each node shows progress bar with color coding (<60% green, 60-80% blue, 80-95% yellow, >95% red). Click node to edit in side panel.

- [ ] **Step 3: Write Audit page**

Timeline view with colored dots (success green, error red). Filter by user/MCP/date range. Click to expand full details (input/output JSON). Export CSV.

- [ ] **Step 4: Write Settings page**

Theme toggle, profile info (from Feishu), notification preferences, API key management (future).

- [ ] **Step 5: Write Login page**

Feishu OAuth button ("使用飞书登录"). Detect Feishu H5 mode for silent login. Unauthorized state for non-whitelisted users.

- [ ] **Step 6: Write NotFound page**

404 with illustration, "返回首页" button.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/pages/
git commit -m "feat(dashboard): add admin pages (Users, Quotas, Audit, Settings, Login)"
```

---

### Task 12: Final Integration & Build

- [ ] **Step 1: Verify dev server**

Run: `cd packages/dashboard && bun run dev`
Expected: Vite dev server starts on port 3200, proxy works.

- [ ] **Step 2: Run typecheck**

Run: `cd packages/dashboard && bun typecheck`
Expected: No type errors.

- [ ] **Step 3: Build production**

Run: `cd packages/dashboard && bun run build`
Expected: Build succeeds, output in `dist/`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(dashboard): P2b complete - enterprise web dashboard"
```

---

## Summary

P2b delivers:
1. Solid.js dashboard package with Vite + Tailwind
2. Complete design token system (light/dark themes via CSS variables)
3. 11 base UI components (Button, Input, Card, Modal, Toast, Badge, etc.)
4. Layout system (Sidebar, Topbar, responsive mobile nav)
5. Chat page with streaming, tool call cards, reasoning blocks, approval cards
6. MCP Marketplace with card grid, filters, detail view
7. Analytics dashboard with KPI cards, ECharts charts, time range selector
8. Admin pages: Users, Quotas (tree view), Audit (timeline), Settings
9. Login page with Feishu OAuth integration
10. WebSocket client with auto-reconnect and exponential backoff

**Total:** ~50 components, 10 pages, 5 stores, 4 lib modules
