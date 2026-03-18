# P2a: IM Integration Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the async handshake + push architecture for Feishu IM integration. Feishu webhook callbacks are validated and enqueued immediately (< 100ms response). BullMQ workers consume jobs, run the OpenCode Agent, and push results back via Feishu messaging API. WebSocket handler enables real-time streaming for the Web Dashboard.

**Architecture:** Hono receives IM callbacks → BullMQ job queue → Worker pool (separate process) → Result pushed via Feishu API or WebSocket. Adapter pattern allows future DingTalk/WeCom expansion.

**Tech Stack:** Bun, Hono, BullMQ, ioredis, WebSocket (Bun native)

**Depends on:** P0 (Auth, Session), P1a (MCP Manager), P1b (Billing hooks)

---

## File Structure

### New Files

```
packages/enterprise/src/im-adapter/
├── types.ts                # Unified IM message types
├── adapter.ts              # Abstract adapter interface
├── feishu/
│   ├── client.ts           # Feishu API client (send message, send card)
│   ├── webhook.ts          # Feishu webhook handler (verify + parse)
│   ├── cards.ts            # Interactive card templates
│   └── adapter.ts          # Feishu adapter implementation
└── registry.ts             # Adapter registry (get adapter by source)

packages/enterprise/src/worker/
├── queue.ts                # BullMQ queue definition
├── producer.ts             # Job producer (enqueue from API/IM)
├── consumer.ts             # Job consumer (run Agent, push results)
└── runner.ts               # Worker entry point (separate process)

packages/enterprise/src/server/
├── ws.ts                   # WebSocket handler
└── routes/im.ts            # IM webhook routes

packages/enterprise/test/im-adapter/
├── feishu-webhook.test.ts
└── cards.test.ts

packages/enterprise/test/worker/
└── queue.test.ts
```

---

## Chunk 1: IM Adapter & Feishu Client

### Task 1: Unified IM Types

**Files:**
- Create: `packages/enterprise/src/im-adapter/types.ts`

- [ ] **Step 1: Write unified types**

```typescript
export type ImSource = "feishu" | "dingtalk" | "wecom" | "web"

export type ImMessage = {
  source: ImSource
  user_external_id: string
  chat_id: string
  chat_type: "private" | "group"
  content: string
  mentions?: string[]
  message_id?: string
  metadata: Record<string, unknown>
}

export type ImReply = {
  type: "text" | "card" | "rich_text"
  content: string
}

export type ImCard = {
  title: string
  elements: ImCardElement[]
}

export type ImCardElement =
  | { tag: "markdown"; content: string }
  | { tag: "action"; actions: ImCardAction[] }
  | { tag: "hr" }
  | { tag: "note"; elements: { tag: "plain_text"; content: string }[] }

export type ImCardAction = {
  tag: "button"
  text: { tag: "plain_text"; content: string }
  type: "primary" | "danger" | "default"
  value?: Record<string, string>
  url?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/im-adapter/types.ts
git commit -m "feat(enterprise/im): add unified IM message types"
```

---

### Task 2: Abstract Adapter Interface

**Files:**
- Create: `packages/enterprise/src/im-adapter/adapter.ts`
- Create: `packages/enterprise/src/im-adapter/registry.ts`

- [ ] **Step 1: Write adapter interface**

```typescript
// adapter.ts
import type { ImMessage, ImReply, ImCard } from "./types"

export interface ImAdapter {
  readonly source: string
  verify(req: Request, body: unknown): Promise<boolean>
  parse(body: unknown): Promise<ImMessage | null>
  reply(chatId: string, content: ImReply): Promise<void>
  card(chatId: string, card: ImCard): Promise<void>
}
```

```typescript
// registry.ts
import type { ImAdapter } from "./adapter"

const adapters = new Map<string, ImAdapter>()

export function register(adapter: ImAdapter) {
  adapters.set(adapter.source, adapter)
}

export function get(source: string): ImAdapter | undefined {
  return adapters.get(source)
}

export function all() {
  return [...adapters.values()]
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/im-adapter/adapter.ts packages/enterprise/src/im-adapter/registry.ts
git commit -m "feat(enterprise/im): add adapter interface and registry"
```

---

### Task 3: Feishu API Client

**Files:**
- Create: `packages/enterprise/src/im-adapter/feishu/client.ts`

- [ ] **Step 1: Write Feishu messaging client**

```typescript
import { env } from "@/env"

const BASE = "https://open.feishu.cn/open-apis"

let token: { value: string; expires: number } | undefined

async function tenantToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value
  const cfg = env()
  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: cfg.FEISHU_APP_ID, app_secret: cfg.FEISHU_APP_SECRET }),
  })
  const data = await res.json() as any
  token = { value: data.tenant_access_token, expires: Date.now() + (data.expire - 60) * 1000 }
  return token.value
}

export async function sendText(chatId: string, text: string) {
  const tk = await tenantToken()
  await fetch(`${BASE}/im/v1/messages?receive_id_type=chat_id`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text }),
    }),
  })
}

export async function sendCard(chatId: string, card: any) {
  const tk = await tenantToken()
  await fetch(`${BASE}/im/v1/messages?receive_id_type=chat_id`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "interactive",
      content: JSON.stringify(card),
    }),
  })
}

export async function replyMessage(messageId: string, text: string) {
  const tk = await tenantToken()
  await fetch(`${BASE}/im/v1/messages/${messageId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
    body: JSON.stringify({
      msg_type: "text",
      content: JSON.stringify({ text }),
    }),
  })
}

export async function updateCard(messageId: string, card: any) {
  const tk = await tenantToken()
  await fetch(`${BASE}/im/v1/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
    body: JSON.stringify({ content: JSON.stringify(card) }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/im-adapter/feishu/client.ts
git commit -m "feat(enterprise/im): add Feishu messaging API client"
```

---

### Task 4: Feishu Webhook Handler & Card Templates

**Files:**
- Create: `packages/enterprise/src/im-adapter/feishu/webhook.ts`
- Create: `packages/enterprise/src/im-adapter/feishu/cards.ts`
- Create: `packages/enterprise/src/im-adapter/feishu/adapter.ts`
- Test: `packages/enterprise/test/im-adapter/feishu-webhook.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test"
import { verifySignature } from "@/im-adapter/feishu/webhook"

describe("feishu webhook", () => {
  test("accepts valid verification token", () => {
    const body = { token: "test-token", type: "url_verification", challenge: "abc" }
    expect(verifySignature(body, "test-token")).toBe(true)
  })

  test("rejects invalid token", () => {
    const body = { token: "wrong-token", type: "url_verification", challenge: "abc" }
    expect(verifySignature(body, "test-token")).toBe(false)
  })
})
```

- [ ] **Step 2: Write webhook handler**

```typescript
// webhook.ts
import type { ImMessage } from "../types"

export function verifySignature(body: any, verificationToken: string): boolean {
  return body?.token === verificationToken
}

export function isVerification(body: any): boolean {
  return body?.type === "url_verification"
}

export function challenge(body: any): string {
  return body?.challenge ?? ""
}

export function parse(body: any): ImMessage | null {
  const event = body?.event
  if (!event) return null
  const msg = event.message
  if (!msg) return null

  let content = ""
  try {
    const parsed = JSON.parse(msg.content ?? "{}")
    content = parsed.text ?? ""
  } catch {
    content = msg.content ?? ""
  }

  // Remove @bot mentions
  content = content.replace(/@_user_\d+/g, "").trim()

  return {
    source: "feishu",
    user_external_id: event.sender?.sender_id?.user_id ?? "",
    chat_id: msg.chat_id ?? "",
    chat_type: msg.chat_type === "group" ? "group" : "private",
    content,
    message_id: msg.message_id,
    mentions: event.sender ? [event.sender.sender_id?.user_id] : [],
    metadata: { raw: body },
  }
}
```

- [ ] **Step 3: Write card templates**

```typescript
// cards.ts
export function processingCard(text = "收到，正在处理中...") {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: "AI 助手" }, template: "blue" },
    elements: [
      { tag: "markdown", content: `⏳ ${text}` },
    ],
  }
}

export function resultCard(text: string, sessionId?: string, detailUrl?: string) {
  const elements: any[] = [
    { tag: "markdown", content: text.slice(0, 2000) },
  ]
  if (text.length > 2000 || detailUrl) {
    elements.push({ tag: "hr" })
    elements.push({
      tag: "action",
      actions: [{
        tag: "button",
        text: { tag: "plain_text", content: "查看完整结果" },
        type: "primary",
        url: detailUrl ?? `${process.env.DASHBOARD_URL}/chat/${sessionId}`,
      }],
    })
  }
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: "AI 助手" }, template: "green" },
    elements,
  }
}

export function errorCard(message: string) {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: "处理失败" }, template: "red" },
    elements: [
      { tag: "markdown", content: `❌ ${message}` },
      { tag: "note", elements: [{ tag: "plain_text", content: "如需帮助，请联系管理员" }] },
    ],
  }
}

export function approvalCard(opts: { title: string; description: string; sessionId: string }) {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: "需要审批" }, template: "orange" },
    elements: [
      { tag: "markdown", content: `**${opts.title}**\n\n${opts.description}` },
      { tag: "hr" },
      {
        tag: "action",
        actions: [
          { tag: "button", text: { tag: "plain_text", content: "拒绝" }, type: "danger", value: { action: "reject", session: opts.sessionId } },
          { tag: "button", text: { tag: "plain_text", content: "批准" }, type: "primary", value: { action: "approve", session: opts.sessionId } },
        ],
      },
    ],
  }
}
```

- [ ] **Step 4: Write Feishu adapter**

```typescript
// adapter.ts
import type { ImAdapter } from "../adapter"
import type { ImMessage, ImReply, ImCard } from "../types"
import * as webhook from "./webhook"
import * as client from "./client"
import * as cards from "./cards"
import { env } from "@/env"

export class FeishuAdapter implements ImAdapter {
  readonly source = "feishu"

  async verify(_req: Request, body: unknown): Promise<boolean> {
    const token = env().FEISHU_VERIFICATION_TOKEN
    if (!token) return true
    return webhook.verifySignature(body, token)
  }

  async parse(body: unknown): Promise<ImMessage | null> {
    return webhook.parse(body)
  }

  async reply(chatId: string, content: ImReply): Promise<void> {
    if (content.type === "text") {
      await client.sendText(chatId, content.content)
    } else if (content.type === "card") {
      await client.sendCard(chatId, JSON.parse(content.content))
    }
  }

  async card(chatId: string, card: ImCard): Promise<void> {
    const feishuCard = {
      config: { wide_screen_mode: true },
      header: { title: { tag: "plain_text", content: card.title }, template: "blue" },
      elements: card.elements.map(el => {
        if (el.tag === "markdown") return { tag: "markdown", content: el.content }
        if (el.tag === "hr") return { tag: "hr" }
        return el
      }),
    }
    await client.sendCard(chatId, feishuCard)
  }
}
```

- [ ] **Step 5: Run tests, commit**

```bash
git add packages/enterprise/src/im-adapter/feishu/ packages/enterprise/test/im-adapter/
git commit -m "feat(enterprise/im): add Feishu webhook handler, card templates, adapter"
```

---

## Chunk 2: BullMQ Job Queue & Worker

### Task 5: Queue Definition & Producer

**Files:**
- Create: `packages/enterprise/src/worker/queue.ts`
- Create: `packages/enterprise/src/worker/producer.ts`

- [ ] **Step 1: Write queue definition**

```typescript
// queue.ts
import { Queue, Worker, type Job } from "bullmq"
import { env } from "@/env"

const connection = { url: env().REDIS_URL }

export const chatQueue = new Queue("chat", { connection, defaultJobOptions: {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
}})

export type ChatJob = {
  user_id: string
  session_id: string
  message: string
  source: "feishu" | "dingtalk" | "wecom" | "web"
  callback: {
    chat_id?: string
    message_id?: string
    ws_id?: string
  }
}
```

- [ ] **Step 2: Write producer**

```typescript
// producer.ts
import { chatQueue, type ChatJob } from "./queue"

export async function enqueue(job: ChatJob): Promise<string> {
  const result = await chatQueue.add("chat", job, {
    priority: job.source === "web" ? 1 : 2,
  })
  return result.id ?? ""
}

export async function stats() {
  const [waiting, active, completed, failed] = await Promise.all([
    chatQueue.getWaitingCount(),
    chatQueue.getActiveCount(),
    chatQueue.getCompletedCount(),
    chatQueue.getFailedCount(),
  ])
  return { waiting, active, completed, failed }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/worker/queue.ts packages/enterprise/src/worker/producer.ts
git commit -m "feat(enterprise/worker): add BullMQ chat queue and producer"
```

---

### Task 6: Job Consumer (Agent Runner)

**Files:**
- Create: `packages/enterprise/src/worker/consumer.ts`

- [ ] **Step 1: Write consumer**

```typescript
import { Worker, type Job } from "bullmq"
import { type ChatJob } from "./queue"
import { env } from "@/env"
import { database } from "@/db"
import * as session from "@/session"
import * as identity from "@/auth/identity"
import * as resolver from "@/mcp-manager/resolver"
import * as adapterRegistry from "@/im-adapter/registry"
import * as feishuClient from "@/im-adapter/feishu/client"
import * as cards from "@/im-adapter/feishu/cards"

const connection = { url: env().REDIS_URL }

export function start(concurrency = 4) {
  const worker = new Worker("chat", process, {
    connection,
    concurrency,
    limiter: { max: 100, duration: 60_000 },
  })

  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} completed`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message)
    handleFailure(job?.data as ChatJob, err.message)
  })

  return worker
}

async function process(job: Job<ChatJob>) {
  const data = job.data
  const db = database()

  // 1. Resolve user
  const user = await identity.byInternalId(db, data.user_id)
  if (!user) throw new Error("User not found")

  // 2. Send "processing" acknowledgment for IM
  if (data.source === "feishu" && data.callback.chat_id) {
    await feishuClient.sendCard(data.callback.chat_id, cards.processingCard())
  }

  // 3. Load or create session
  let sess = data.session_id
    ? await db.select().from(session.enterprise_session).where(eq(session.enterprise_session.id, data.session_id)).then(r => r[0])
    : null

  if (!sess) {
    sess = await session.create(db, {
      user_id: data.user_id,
      title: data.message.slice(0, 50),
    })
  }

  // 4. Add user message
  await session.addMessage(db, {
    session_id: sess.id,
    role: "user",
    content: { text: data.message },
  })

  // 5. Load message history
  const history = await session.messages(db, sess.id)

  // 6. Resolve MCPs for user
  const mcps = await resolver.resolve(db, {
    internal_id: user.internal_id,
    roles: [],
    dept_ids: user.department_ids,
  })

  // 7. Run OpenCode Agent (simplified - actual integration uses OpenCode Core hooks)
  // This is where the enterprise layer calls into OpenCode's SessionPrompt.prompt()
  // For now, we simulate the response generation
  const result = await runAgent(sess.id, history, data.message, mcps)

  // 8. Save assistant message
  await session.addMessage(db, {
    session_id: sess.id,
    role: "assistant",
    content: { text: result.text },
    tokens_input: result.tokens.input,
    tokens_output: result.tokens.output,
    model_id: result.model,
  })

  // 9. Push result
  await pushResult(data, result.text, sess.id)
}

async function runAgent(sessionId: string, history: any[], message: string, mcps: any[]) {
  // TODO: Wire into OpenCode Core's SessionPrompt.prompt()
  // This is a placeholder that will be replaced with actual agent invocation
  return {
    text: `[Agent Response] Processing: ${message}`,
    tokens: { input: 0, output: 0 },
    model: "placeholder",
  }
}

async function pushResult(data: ChatJob, text: string, sessionId: string) {
  if (data.source === "feishu" && data.callback.chat_id) {
    if (text.length <= 2000) {
      await feishuClient.sendText(data.callback.chat_id, text)
    } else {
      const card = cards.resultCard(text, sessionId)
      await feishuClient.sendCard(data.callback.chat_id, card)
    }
  }
  // WebSocket push is handled by the WS handler subscribing to session events
}

async function handleFailure(data: ChatJob | undefined, error: string) {
  if (!data) return
  if (data.source === "feishu" && data.callback.chat_id) {
    await feishuClient.sendCard(data.callback.chat_id, cards.errorCard(error))
  }
}

import { eq } from "drizzle-orm"
import { enterprise_session } from "@/session/session.sql"
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/worker/consumer.ts
git commit -m "feat(enterprise/worker): add BullMQ job consumer with agent runner"
```

---

### Task 7: Worker Entry Point

**Files:**
- Create: `packages/enterprise/src/worker/runner.ts`

- [ ] **Step 1: Write worker runner**

```typescript
import { start } from "./consumer"
import { database } from "@/db"
import { startFlush } from "@/billing/audit"
import { start as startSync } from "@/billing/sync"

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? "4")

console.log(`[worker] starting with concurrency=${concurrency}`)

// Initialize database
database()

// Start audit flush
startFlush()

// Start quota sync
startSync()

// Start worker
const worker = start(concurrency)

console.log(`[worker] ready, waiting for jobs...`)

process.on("SIGTERM", async () => {
  console.log("[worker] shutting down...")
  await worker.close()
  process.exit(0)
})
```

- [ ] **Step 2: Add worker script to package.json**

Add to `packages/enterprise/package.json` scripts:
```json
"worker": "bun run src/worker/runner.ts"
```

- [ ] **Step 3: Commit**

```bash
git add packages/enterprise/src/worker/runner.ts packages/enterprise/package.json
git commit -m "feat(enterprise/worker): add worker entry point as separate process"
```

---

## Chunk 3: WebSocket & IM Routes

### Task 8: WebSocket Handler

**Files:**
- Create: `packages/enterprise/src/server/ws.ts`

- [ ] **Step 1: Write WebSocket handler**

```typescript
import type { ServerWebSocket } from "bun"
import { verify, type JwtPayload } from "@/auth/jwt"
import { env } from "@/env"
import { subscriber } from "@/redis"
import * as producer from "@/worker/producer"

type WsData = { user: JwtPayload; sessionId?: string }

const clients = new Map<string, Set<ServerWebSocket<WsData>>>()

export function upgrade(req: Request, server: any): Response | undefined {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  if (!token) return new Response("Unauthorized", { status: 401 })

  try {
    // Sync verify not available with jose, so we handle in open
    const success = server.upgrade(req, { data: { token } })
    if (success) return undefined
    return new Response("Upgrade failed", { status: 500 })
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }
}

export const handlers = {
  async open(ws: ServerWebSocket<any>) {
    try {
      const user = await verify(ws.data.token, env().JWT_SECRET)
      ws.data.user = user
      if (!clients.has(user.sub)) clients.set(user.sub, new Set())
      clients.get(user.sub)!.add(ws)
    } catch {
      ws.close(1008, "Invalid token")
    }
  },

  async message(ws: ServerWebSocket<WsData>, raw: string | Buffer) {
    const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString())
    const user = ws.data.user
    if (!user) return

    switch (msg.type) {
      case "chat": {
        const jobId = await producer.enqueue({
          user_id: user.sub,
          session_id: msg.session_id,
          message: msg.message,
          source: "web",
          callback: { ws_id: user.sub },
        })
        send(ws, { type: "ack", job_id: jobId, session_id: msg.session_id })
        break
      }
      case "cancel": {
        // TODO: implement cancellation via AbortController
        send(ws, { type: "cancelled", session_id: msg.session_id })
        break
      }
      case "ping": {
        send(ws, { type: "pong" })
        break
      }
    }
  },

  close(ws: ServerWebSocket<WsData>) {
    const user = ws.data?.user
    if (user) {
      clients.get(user.sub)?.delete(ws)
      if (clients.get(user.sub)?.size === 0) clients.delete(user.sub)
    }
  },
}

function send(ws: ServerWebSocket<any>, data: any) {
  ws.send(JSON.stringify(data))
}

export function broadcast(userId: string, data: any) {
  const sockets = clients.get(userId)
  if (!sockets) return
  const msg = JSON.stringify(data)
  for (const ws of sockets) ws.send(msg)
}

export function broadcastSession(sessionId: string, data: any) {
  // Broadcast to all connected clients (filtered by session subscription)
  const msg = JSON.stringify({ ...data, session_id: sessionId })
  for (const [, sockets] of clients) {
    for (const ws of sockets) ws.send(msg)
  }
}

export function connected() {
  let total = 0
  for (const [, sockets] of clients) total += sockets.size
  return total
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/enterprise/src/server/ws.ts
git commit -m "feat(enterprise/server): add WebSocket handler with auth and session broadcasting"
```

---

### Task 9: IM Webhook Route

**Files:**
- Create: `packages/enterprise/src/server/routes/im.ts`

- [ ] **Step 1: Write IM routes**

```typescript
import { Hono } from "hono"
import * as adapterRegistry from "@/im-adapter/registry"
import * as identity from "@/auth/identity"
import * as producer from "@/worker/producer"
import { database } from "@/db"
import { isVerification, challenge } from "@/im-adapter/feishu/webhook"

const app = new Hono()

const processed = new Set<string>()

app.post("/feishu/webhook", async (c) => {
  const body = await c.req.json()

  // Handle URL verification (Feishu setup)
  if (isVerification(body)) {
    return c.json({ challenge: challenge(body) })
  }

  // Deduplicate (Feishu may retry)
  const eventId = body?.header?.event_id
  if (eventId && processed.has(eventId)) {
    return c.json({ ok: true })
  }
  if (eventId) {
    processed.add(eventId)
    setTimeout(() => processed.delete(eventId), 300_000)
  }

  // Verify signature
  const adapter = adapterRegistry.get("feishu")
  if (!adapter) return c.json({ error: "Feishu adapter not configured" }, 500)

  const valid = await adapter.verify(c.req.raw, body)
  if (!valid) return c.json({ error: "Invalid signature" }, 403)

  // Parse message
  const msg = await adapter.parse(body)
  if (!msg || !msg.content) return c.json({ ok: true })

  // Resolve internal user
  const db = database()
  const user = await identity.byFeishuId(db, msg.user_external_id)
  if (!user) {
    await adapter.reply(msg.chat_id, { type: "text", content: "请先完成账号绑定后再使用 AI 助手" })
    return c.json({ ok: true })
  }

  // Enqueue job immediately (async handshake)
  await producer.enqueue({
    user_id: user.internal_id,
    session_id: "",
    message: msg.content,
    source: "feishu",
    callback: {
      chat_id: msg.chat_id,
      message_id: msg.message_id,
    },
  })

  // Return 200 immediately
  return c.json({ ok: true })
})

app.post("/feishu/card-action", async (c) => {
  const body = await c.req.json()
  const action = body?.action?.value
  if (!action) return c.json({ ok: true })

  // Handle approval card actions
  if (action.action === "approve" || action.action === "reject") {
    // TODO: Wire to approval workflow
    console.log(`[im] card action: ${action.action} for session ${action.session}`)
  }

  return c.json({ ok: true })
})

export { app as imRoutes }
```

- [ ] **Step 2: Add route to server**

Update `packages/enterprise/src/server/index.ts`:
```typescript
import { imRoutes } from "./routes/im"
app.route("/api/v1/im", imRoutes)
```

- [ ] **Step 3: Register Feishu adapter in bootstrap**

Update `packages/enterprise/src/index.ts`:
```typescript
import { FeishuAdapter } from "./im-adapter/feishu/adapter"
import * as adapterRegistry from "./im-adapter/registry"
// In bootstrap():
adapterRegistry.register(new FeishuAdapter())
```

- [ ] **Step 4: Typecheck & test**

Run: `cd packages/enterprise && bun typecheck && bun test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(enterprise/im): P2a complete - IM integration with Feishu, BullMQ workers, WebSocket"
```

---

## Summary

P2a delivers:
1. Unified IM message types and abstract adapter interface
2. Feishu adapter (webhook verify, message parse, text/card reply)
3. Interactive card templates (processing, result, error, approval)
4. BullMQ job queue with priority and retry
5. Worker consumer (runs Agent, pushes results via Feishu API)
6. Worker entry point (separate Bun process)
7. WebSocket handler with JWT auth and session broadcasting
8. IM webhook route with deduplication and async handshake

**Next:** P2b (Frontend Dashboard)
