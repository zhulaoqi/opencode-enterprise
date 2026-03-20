import { createSignal } from "solid-js"
import { sseUrl, markReady, markDisconnected, status as workerStatus } from "./worker"
import { token } from "../stores/auth"

type Handler = (data: Record<string, unknown>) => void

const handlers = new Map<string, Set<Handler>>()
let source: EventSource | null = null
let debounce: ReturnType<typeof setTimeout> | null = null

const [streaming, setStreaming] = createSignal(false)
export { streaming }

export function connect() {
  close()
  if (workerStatus() === "disconnected") return
  const href = sseUrl("/global/event")
  const tk = token()
  const url = tk ? `${href}${href.includes("?") ? "&" : "?"}token=${tk}` : href
  source = new EventSource(url)

  source.onopen = () => {
    if (debounce) { clearTimeout(debounce); debounce = null }
    setStreaming(true)
    markReady()
    console.log("[sse] connected")
  }

  source.onmessage = (e) => {
    try {
      const raw = JSON.parse(e.data)
      const msg = raw.payload ?? raw
      emit(msg.type, msg.properties ?? msg)
    } catch {}
  }

  source.onerror = () => {
    setStreaming(false)
    if (debounce) return
    debounce = setTimeout(() => {
      debounce = null
      console.warn("[sse] error, triggering reconnect")
      close()
      markDisconnected()
    }, 1000)
  }
}

export function close() {
  if (debounce) { clearTimeout(debounce); debounce = null }
  source?.close()
  source = null
  setStreaming(false)
}

export function on(type: string, fn: Handler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set())
  handlers.get(type)!.add(fn)
  return () => { handlers.get(type)?.delete(fn) }
}

function emit(type: string, data: Record<string, unknown>) {
  const fns = handlers.get(type)
  if (fns) for (const fn of fns) fn(data)
}
