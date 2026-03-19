import type { ServerWebSocket } from "bun"
import { verify, type JwtPayload } from "@/auth/jwt"
import { env } from "@/env"
import * as producer from "@/worker/producer"

type WsData = { token?: string; user?: JwtPayload; sessions?: Set<string> }

const clients = new Map<string, Set<ServerWebSocket<WsData>>>()
const sessionSubs = new Map<string, Set<ServerWebSocket<WsData>>>()

export function upgrade(req: Request, server: { upgrade: (r: Request, opts?: { data?: WsData }) => boolean }): Response | undefined {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  if (!token) return new Response("Unauthorized", { status: 401 })

  const ok = server.upgrade(req, { data: { token } })
  if (!ok) return new Response("Upgrade failed", { status: 500 })
  return undefined
}

export const handlers = {
  async open(ws: ServerWebSocket<WsData>) {
    const token = ws.data.token
    if (!token) {
      ws.close(1008, "Missing token")
      return
    }
    try {
      const user = await verify(token, env().JWT_SECRET)
      ws.data.user = user
      ws.data.sessions = new Set()
      if (!clients.has(user.sub)) clients.set(user.sub, new Set())
      clients.get(user.sub)!.add(ws)
    } catch {
      ws.close(1008, "Invalid token")
    }
  },

  async message(ws: ServerWebSocket<WsData>, raw: string | Buffer) {
    const user = ws.data.user
    if (!user) return

    const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString()) as {
      type: string
      session_id?: string
      message?: string
    }
    switch (msg.type) {
      case "chat": {
        const sid = msg.session_id ?? ""
        const jobId = await producer.enqueue({
          user_id: user.sub,
          session_id: sid,
          message: msg.message ?? "",
          source: "web",
          callback: { ws_id: user.sub },
        })
        subscribe(ws, sid)
        send(ws, { type: "ack", job_id: jobId, session_id: sid })
        break
      }
      case "subscribe": {
        if (msg.session_id) subscribe(ws, msg.session_id)
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
  },
}

function subscribe(ws: ServerWebSocket<WsData>, sid: string) {
  ws.data.sessions?.add(sid)
  if (!sessionSubs.has(sid)) sessionSubs.set(sid, new Set())
  sessionSubs.get(sid)!.add(ws)
}

function send(ws: ServerWebSocket<WsData>, data: unknown) {
  ws.send(JSON.stringify(data))
}

export function broadcast(userId: string, data: unknown) {
  const sockets = clients.get(userId)
  if (!sockets) return
  const msg = JSON.stringify(data)
  for (const ws of sockets) ws.send(msg)
}

export function broadcastSession(sessionId: string, data: unknown) {
  const subs = sessionSubs.get(sessionId)
  if (subs) {
    const msg = JSON.stringify({ ...(data as object), session_id: sessionId })
    for (const ws of subs) ws.send(msg)
    return
  }
  const msg = JSON.stringify({ ...(data as object), session_id: sessionId })
  for (const [, sockets] of clients) {
    for (const ws of sockets) ws.send(msg)
  }
}

export function emitTextDelta(sessionId: string, content: string) {
  broadcastSession(sessionId, { type: "text_delta", content })
}

export function emitToolCall(sessionId: string, tool: string, mcp: string, status: "start" | "done" | "error", extra?: Record<string, unknown>) {
  broadcastSession(sessionId, { type: "tool_call", tool, mcp, status, ...extra })
}

export function emitReasoning(sessionId: string, content: string) {
  broadcastSession(sessionId, { type: "reasoning", content })
}

export function emitDone(sessionId: string, usage?: Record<string, unknown>) {
  broadcastSession(sessionId, { type: "done", usage })
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

export function connected() {
  let total = 0
  for (const [, sockets] of clients) total += sockets.size
  return total
}
