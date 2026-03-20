import { createSignal } from "solid-js"
import { request } from "../lib/worker"
import { on as sseOn } from "../lib/stream"

export type Session = {
  id: string
  title: string
  time: { created: number; updated: number }
}

export type Message = {
  id: string
  role: string
  time: number
  text: string
  reasoning?: string
  tokens?: { input: number; output: number }
}

const [sessions, setSessions] = createSignal<Session[]>([])
const [activeId, setActiveId] = createSignal("")
const [messages, setMessages] = createSignal<Message[]>([])
const [streaming, setStreaming] = createSignal("")
const [isStreaming, setIsStreaming] = createSignal(false)

export { sessions, setSessions, activeId, setActiveId, messages, setMessages, streaming, isStreaming }

export async function loadSessions() {
  try {
    const raw = await request<any[]>("/session")
    const rows: Session[] = (Array.isArray(raw) ? raw : []).map((s) => ({
      id: s.id,
      title: s.title || "新对话",
      time: { created: s.time?.created ?? 0, updated: s.time?.updated ?? 0 },
    }))
    setSessions(rows)
  } catch (e) {
    console.warn("[chat] loadSessions failed:", e)
    setSessions([])
  }
}

function flatten(raw: any[]): Message[] {
  return (Array.isArray(raw) ? raw : []).map((m) => {
    const info = m.info ?? m
    const parts: any[] = m.parts ?? []
    const text = parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text ?? "")
      .join("\n")
    const reasoning = parts.find((p: any) => p.type === "reasoning")?.text
    return {
      id: info.id,
      role: info.role,
      time: info.time?.created ?? 0,
      text,
      reasoning,
      tokens: info.tokens,
    }
  })
}

export async function loadMessages(id: string) {
  setActiveId(id)
  try {
    const raw = await request<any[]>(`/session/${id}/message`)
    setMessages(flatten(raw))
  } catch (e) {
    console.warn("[chat] loadMessages failed:", e)
  }
}

export async function createSession(): Promise<string> {
  const sess = await request<{ id: string }>("/session", { method: "POST", body: JSON.stringify({}) })
  const now = Date.now()
  setSessions((prev) => [
    { id: sess.id, title: "新对话", time: { created: now, updated: now } },
    ...prev,
  ])
  return sess.id
}

export async function deleteSession(id: string) {
  await request<void>(`/session/${id}`, { method: "DELETE" })
  if (activeId() === id) {
    setActiveId("")
    setMessages([])
  }
  await loadSessions()
}

let streamTimeout: ReturnType<typeof setTimeout>

export async function sendMessage(text: string, _model?: string) {
  let id = activeId()
  if (!id) {
    id = await createSession()
    setActiveId(id)
  }
  if (isStreaming()) {
    setIsStreaming(false)
    setStreaming("")
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
  const prev = messages()
  const first = prev.length === 0
  setMessages([
    ...prev,
    {
      id: crypto.randomUUID(),
      role: "user",
      time: Date.now(),
      text,
    },
  ])
  if (first) {
    const label = text.length > 30 ? text.slice(0, 30) + "..." : text
    setSessions((all) => all.map((s) => (s.id === id ? { ...s, title: label } : s)))
  }
  try {
    await request<void>(`/session/${id}/prompt_async`, {
      method: "POST",
      body: JSON.stringify({ parts: [{ type: "text", text }] }),
    })
    startPolling()
  } catch (e) {
    setIsStreaming(false)
    setStreaming("")
    clearTimeout(streamTimeout)
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        time: Date.now(),
        text: `⚠️ ${(e as Error).message}`,
      },
    ])
  }
}

export async function cancelStream() {
  const id = activeId()
  if (!id) return
  try {
    await request<void>(`/session/${id}/abort`, { method: "POST" })
  } catch {}
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
    if (count > 60) {
      clearInterval(pollTimer)
      setIsStreaming(false)
      return
    }
    try {
      const raw = await request<any[]>(`/session/${id}/message`)
      const msgs = flatten(raw)
      setMessages(msgs)
      const last = msgs.at(-1)
      if (last?.role === "assistant") {
        clearInterval(pollTimer)
        clearTimeout(streamTimeout)
        setIsStreaming(false)
        setStreaming("")
      }
    } catch {}
  }, 2000)
}

sseOn("session.prompt.completed", (msg) => {
  clearInterval(pollTimer)
  clearTimeout(streamTimeout)
  setIsStreaming(false)
  const payload = msg as { sessionID?: string }
  if (payload.sessionID === activeId()) {
    loadMessages(activeId())
  }
  setStreaming("")
})

sseOn("session.prompt.error", (msg) => {
  clearInterval(pollTimer)
  clearTimeout(streamTimeout)
  setIsStreaming(false)
  setStreaming("")
  const payload = msg as { sessionID?: string; error?: string }
  if (payload.sessionID === activeId() && payload.error) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        time: Date.now(),
        text: `⚠️ ${payload.error}`,
      },
    ])
  }
})

sseOn("session.updated", (msg) => {
  const payload = msg as { id?: string }
  if (payload.id === activeId()) {
    loadMessages(activeId())
  }
})
