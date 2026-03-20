import { createSignal } from "solid-js"
import { request } from "../lib/worker"
import { on as sseOn } from "../lib/stream"

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
  try {
    const rows = await request<Session[]>("/session/")
    setSessions(Array.isArray(rows) ? rows : [])
  } catch (e) {
    console.warn("[chat] loadSessions failed:", e)
    setSessions([])
  }
}

export async function loadMessages(id: string) {
  setActiveId(id)
  try {
    const rows = await request<Message[]>(`/session/${id}/message`)
    setMessages(Array.isArray(rows) ? rows : [])
  } catch (e) {
    console.warn("[chat] loadMessages failed:", e)
  }
}

export async function createSession(): Promise<string> {
  const sess = await request<{ id: string }>("/session/", { method: "POST", body: JSON.stringify({}) })
  await loadSessions()
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
  setMessages((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      role: "user",
      content: { text },
      created_at: new Date().toISOString(),
    },
  ])
  try {
    await request<void>(`/session/${id}/prompt_async`, {
      method: "POST",
      body: JSON.stringify({ content: text }),
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
        content: { text: `⚠️ ${(e as Error).message}` },
        created_at: new Date().toISOString(),
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
      const rows = await request<Message[]>(`/session/${id}/message`)
      setMessages(Array.isArray(rows) ? rows : [])
      const last = rows?.at(-1)
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
        content: { text: `⚠️ ${payload.error}` },
        created_at: new Date().toISOString(),
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
