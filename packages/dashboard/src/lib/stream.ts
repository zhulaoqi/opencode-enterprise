import { createSignal } from "solid-js"
import { sseUrl } from "./worker"

type Handler = (data: Record<string, unknown>) => void

const handlers = new Map<string, Set<Handler>>()
let source: EventSource | null = null

const [streaming, setStreaming] = createSignal(false)
export { streaming }

export function connect() {
  close()
  const href = sseUrl("/event")
  source = new EventSource(href)

  source.onopen = () => {
    setStreaming(true)
    console.log("[sse] connected")
  }

  source.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      emit(msg.type, msg.properties ?? msg)
    } catch {}
  }

  source.onerror = () => {
    setStreaming(false)
    console.warn("[sse] error, will auto-reconnect")
  }
}

export function close() {
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
