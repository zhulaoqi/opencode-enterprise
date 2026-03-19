import type { ServerWebSocket } from "bun"
import { verify, type JwtPayload } from "@/auth/jwt"
import { env } from "@/env"
import * as producer from "@/worker/producer"

// ---------------------------------------------------------------------------
// Types & config
// ---------------------------------------------------------------------------
type WsData = { token?: string; user?: JwtPayload; sessions?: Set<string>; alive?: number }

const HEARTBEAT_TIMEOUT = 60_000
const SWEEP_INTERVAL = 30_000
const MAX_PER_USER = 10

const clients = new Map<string, Set<ServerWebSocket<WsData>>>()
const sessionSubs = new Map<string, Set<ServerWebSocket<WsData>>>()

// ---------------------------------------------------------------------------
// Stale connection sweeper
// ---------------------------------------------------------------------------
let sweeper: ReturnType<typeof setInterval>

export function startSweeper() {
  sweeper = setInterval(() => {
    const now = Date.now()
    for (const [uid, sockets] of clients) {
      for (const ws of sockets) {
        if (now - (ws.data.alive ?? 0) > HEARTBEAT_TIMEOUT) {
          console.log(`[ws] sweeping stale connection for user=${uid}`)
          ws.close(4001, "heartbeat timeout")
        }
      }
    }
  }, SWEEP_INTERVAL)
}

export function stopSweeper() {
  clearInterval(sweeper)
}

// ---------------------------------------------------------------------------
// Safe send — never throw on closed socket
// ---------------------------------------------------------------------------
function safeSend(ws: ServerWebSocket<WsData>, raw: string) {
  try { ws.send(raw) } catch { /* closed */ }
}

function send(ws: ServerWebSocket<WsData>, data: unknown) {
  safeSend(ws, JSON.stringify(data))
}

// ---------------------------------------------------------------------------
// Upgrade
// ---------------------------------------------------------------------------
export function upgrade(req: Request, server: { upgrade: (r: Request, opts?: { data?: WsData }) => boolean }): Response | undefined {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  if (!token) return new Response("Unauthorized", { status: 401 })

  const ok = server.upgrade(req, { data: { token } })
  if (!ok) return new Response("Upgrade failed", { status: 500 })
  return undefined
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
export const handlers = {
  async open(ws: ServerWebSocket<WsData>) {
    const token = ws.data.token
    if (!token) { ws.close(1008, "Missing token"); return }
    try {
      const user = await verify(token, env().JWT_SECRET)
      ws.data.user = user
      ws.data.sessions = new Set()
      ws.data.alive = Date.now()
      if (!clients.has(user.sub)) clients.set(user.sub, new Set())
      const set = clients.get(user.sub)!

      if (set.size >= MAX_PER_USER) {
        const oldest = set.values().next().value
        if (oldest) { oldest.close(4002, "too many connections"); set.delete(oldest) }
      }

      set.add(ws)
      console.log(`[ws] open user=${user.sub} total=${totalConnected()}`)
    } catch {
      ws.close(1008, "Invalid token")
    }
  },

  async message(ws: ServerWebSocket<WsData>, raw: string | Buffer) {
    const user = ws.data.user
    if (!user) return

    ws.data.alive = Date.now()

    let msg: { type: string; session_id?: string; message?: string; model_id?: string }
    try { msg = JSON.parse(typeof raw === "string" ? raw : raw.toString()) } catch { return }

    switch (msg.type) {
      case "chat": {
        const sid = msg.session_id ?? ""
        if (!msg.message?.trim()) { send(ws, { type: "error", code: "empty_message", message: "消息不能为空" }); return }
        try {
          const jobId = await producer.enqueue({
            user_id: user.sub,
            session_id: sid,
            message: msg.message,
            source: "web",
            model_id: msg.model_id,
            callback: { ws_id: user.sub },
          })
          subscribe(ws, sid)
          send(ws, { type: "ack", job_id: jobId, session_id: sid })
        } catch (err) {
          send(ws, { type: "error", code: "enqueue_failed", message: err instanceof Error ? err.message : "入队失败" })
        }
        break
      }
      case "subscribe": {
        if (msg.session_id) subscribe(ws, msg.session_id)
        break
      }
      case "unsubscribe": {
        if (msg.session_id) unsubscribe(ws, msg.session_id)
        break
      }
      case "cancel": {
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
    for (const sid of ws.data?.sessions ?? []) {
      sessionSubs.get(sid)?.delete(ws)
      if (sessionSubs.get(sid)?.size === 0) sessionSubs.delete(sid)
    }
    if (user) console.log(`[ws] close user=${user.sub} total=${totalConnected()}`)
  },
}

// ---------------------------------------------------------------------------
// Subscribe / unsubscribe
// ---------------------------------------------------------------------------
function subscribe(ws: ServerWebSocket<WsData>, sid: string) {
  ws.data.sessions?.add(sid)
  if (!sessionSubs.has(sid)) sessionSubs.set(sid, new Set())
  sessionSubs.get(sid)!.add(ws)
}

function unsubscribe(ws: ServerWebSocket<WsData>, sid: string) {
  ws.data.sessions?.delete(sid)
  sessionSubs.get(sid)?.delete(ws)
  if (sessionSubs.get(sid)?.size === 0) sessionSubs.delete(sid)
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------
export function broadcast(userId: string, data: unknown) {
  const sockets = clients.get(userId)
  if (!sockets?.size) return
  const raw = JSON.stringify(data)
  for (const ws of sockets) safeSend(ws, raw)
}

export function broadcastSession(sessionId: string, data: unknown) {
  const subs = sessionSubs.get(sessionId)
  const raw = JSON.stringify({ ...(data as object), session_id: sessionId })
  if (subs?.size) {
    for (const ws of subs) safeSend(ws, raw)
    return
  }
  for (const [, sockets] of clients) {
    for (const ws of sockets) safeSend(ws, raw)
  }
}

// ---------------------------------------------------------------------------
// Typed emitters
// ---------------------------------------------------------------------------
export function emitTextDelta(sessionId: string, content: string) {
  broadcastSession(sessionId, { type: "text_delta", content })
}

export function emitToolCall(sessionId: string, tool: string, mcp: string, status: "start" | "done" | "error", extra?: Record<string, unknown>) {
  broadcastSession(sessionId, { type: "tool_call", tool, mcp, status, ...extra })
}

export function emitReasoning(sessionId: string, content: string) {
  broadcastSession(sessionId, { type: "reasoning", content })
}

export function emitDone(sessionId: string, payload?: Record<string, unknown>) {
  broadcastSession(sessionId, { type: "done", ...payload })
}

export function emitError(sessionId: string, code: string, message: string) {
  broadcastSession(sessionId, { type: "error", code, message })
}

export function emitMcpChange(userId: string, added: string[], removed: string[]) {
  broadcast(userId, { type: "mcp_change", added, removed })
}

export function emitQuotaWarning(userId: string, pct: number, message: string) {
  broadcast(userId, { type: "quota_warning", remaining_pct: pct, message })
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function totalConnected() {
  let total = 0
  for (const [, sockets] of clients) total += sockets.size
  return total
}

export { totalConnected as connected }
