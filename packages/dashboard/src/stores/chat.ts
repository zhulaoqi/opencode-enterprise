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
  const rows = await api.get<Message[]>("/sessions/" + id)
  setMessages(Array.isArray(rows) ? rows : [])
}

export function sendMessage(text: string) {
  const id = activeId()
  if (!id) return
  setIsStreaming(true)
  setStreaming("")
  wsSend({ type: "chat", session_id: id, message: text })
}

export function cancelStream() {
  wsSend({ type: "cancel", session_id: activeId() })
  setIsStreaming(false)
}

let pollTimer: ReturnType<typeof setTimeout>
function startPolling() {
  clearInterval(pollTimer)
  const id = activeId()
  if (!id) return
  let count = 0
  pollTimer = setInterval(async () => {
    count++
    if (count > 15) {
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

wsOn("done", (msg) => {
  clearInterval(pollTimer)
  setIsStreaming(false)
  const payload = msg as { session_id?: string; text?: string }
  if (payload.session_id === activeId() && payload.text) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: { text: payload.text },
        created_at: new Date().toISOString(),
      },
    ])
  }
})
