import { createSignal } from "solid-js"
import { api } from "../lib/api"
import { on as wsOn, send as wsSend } from "../lib/ws"

export type Session = {
  id: string
  title: string | null
  updated_at: string
  created_at: string
}

export type Message = {
  id: string
  role: string
  content: { text?: string; tools?: unknown[]; reasoning?: string; reasoning_duration?: number }
  created_at: string
}

const [sessions, setSessions] = createSignal<Session[]>([])
const [activeId, setActiveId] = createSignal("")
const [messages, setMessages] = createSignal<Message[]>([])
const [streaming, setStreaming] = createSignal("")
const [isStreaming, setIsStreaming] = createSignal(false)

export { sessions, setSessions, activeId, setActiveId, messages, setMessages, streaming, isStreaming }

export async function loadSessions() {
  const rows = await api.get<Session[]>("/sessions")
  setSessions(Array.isArray(rows) ? rows : [])
}

export async function loadMessages(id: string) {
  setActiveId(id)
  wsSend({ type: "subscribe", session_id: id })
  const rows = await api.get<Message[]>("/sessions/" + id)
  setMessages(Array.isArray(rows) ? rows : [])
}

let streamTimeout: ReturnType<typeof setTimeout>

export function sendMessage(text: string, model?: string) {
  const id = activeId()
  if (!id) return
  if (isStreaming()) {
    setIsStreaming(false)
    setStreaming("")
    clearInterval(pollTimer)
  }
  setIsStreaming(true)
  setStreaming("")
  clearTimeout(streamTimeout)
  streamTimeout = setTimeout(() => {
    if (isStreaming()) {
      setIsStreaming(false)
      setStreaming("")
      loadMessages(activeId())
    }
  }, 120_000)
  setMessages((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      role: "user",
      content: { text },
      created_at: new Date().toISOString(),
    },
  ])
  wsSend({ type: "chat", session_id: id, message: text, ...(model && { model_id: model }) })
}

export function cancelStream() {
  wsSend({ type: "cancel", session_id: activeId() })
  setIsStreaming(false)
  setStreaming("")
}

let pollTimer: ReturnType<typeof setTimeout>
function startPolling() {
  clearInterval(pollTimer)
  const id = activeId()
  if (!id) return
  let count = 0
  pollTimer = setInterval(async () => {
    count++
    if (count > 30) {
      clearInterval(pollTimer)
      setIsStreaming(false)
      return
    }
    const rows = await api.get<Message[]>("/sessions/" + id)
    setMessages(Array.isArray(rows) ? rows : [])
    const last = rows?.at(-1)
    if (last?.role === "assistant") {
      clearInterval(pollTimer)
      setIsStreaming(false)
    }
  }, 2000)
}

wsOn("ack", () => {
  startPolling()
})

wsOn("text_delta", (msg) => {
  const payload = msg as { session_id?: string; content?: string }
  if (payload.session_id === activeId() && payload.content) {
    setStreaming((prev) => prev + payload.content)
  }
})

wsOn("reasoning", (msg) => {
  const payload = msg as { session_id?: string; content?: string }
  if (payload.session_id !== activeId()) return
  setMessages((prev) => {
    const last = prev.at(-1)
    if (last?.role === "assistant" && last.content.reasoning !== undefined) {
      return [...prev.slice(0, -1), { ...last, content: { ...last.content, reasoning: (last.content.reasoning ?? "") + (payload.content ?? "") } }]
    }
    return prev
  })
})

wsOn("tool_call", (msg) => {
  const payload = msg as { session_id?: string; tool?: string; mcp?: string; status?: string; input?: unknown; output?: unknown; duration_ms?: number }
  if (payload.session_id !== activeId()) return
  setMessages((prev) => {
    const last = prev.at(-1)
    if (last?.role === "assistant") {
      const tools = [...(last.content.tools ?? []) as Record<string, unknown>[], { name: payload.tool, mcp: payload.mcp, status: payload.status, input: payload.input, output: payload.output, duration_ms: payload.duration_ms }]
      return [...prev.slice(0, -1), { ...last, content: { ...last.content, tools } }]
    }
    return prev
  })
})

wsOn("done", (msg) => {
  clearInterval(pollTimer)
  clearTimeout(streamTimeout)
  setIsStreaming(false)
  const payload = msg as { session_id?: string; text?: string }
  if (payload.session_id !== activeId()) return
  const buf = streaming()
  if (buf) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: { text: buf },
        created_at: new Date().toISOString(),
      },
    ])
    setStreaming("")
  } else if (payload.text) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: { text: payload.text },
        created_at: new Date().toISOString(),
      },
    ])
  } else {
    loadMessages(activeId())
  }
})

wsOn("error", (msg) => {
  clearInterval(pollTimer)
  clearTimeout(streamTimeout)
  setIsStreaming(false)
  setStreaming("")
  const payload = msg as { session_id?: string; message?: string }
  if (payload.session_id === activeId() && payload.message) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: { text: `⚠️ ${payload.message}` },
        created_at: new Date().toISOString(),
      },
    ])
  }
})

wsOn("quota_warning", (msg) => {
  const payload = msg as { remaining_pct?: number; message?: string }
  if (payload.message) {
    import("../stores/notification").then((m) => m.notify("warning", payload.message!))
  }
})

wsOn("mcp_change", (msg) => {
  const payload = msg as { added?: string[]; removed?: string[] }
  const parts: string[] = []
  if (payload.added?.length) parts.push(`新增: ${payload.added.join(", ")}`)
  if (payload.removed?.length) parts.push(`移除: ${payload.removed.join(", ")}`)
  if (parts.length) {
    import("../stores/notification").then((m) => m.notify("info", `MCP 工具变更 — ${parts.join("; ")}`))
  }
})

wsOn("_disconnect", () => {
  clearInterval(pollTimer)
  clearTimeout(streamTimeout)
  if (isStreaming()) {
    setIsStreaming(false)
    setStreaming("")
  }
})

wsOn("_reconnect", () => {
  const id = activeId()
  if (id) wsSend({ type: "subscribe", session_id: id })
})
