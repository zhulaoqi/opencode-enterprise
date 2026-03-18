import { createSignal } from "solid-js"
import { token } from "../stores/auth"

type WsMsg = Record<string, unknown>
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
    const msg = JSON.parse(e.data as string) as WsMsg
    const fns = handlers.get(msg.type as string)
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
function startPing() {
  pingTimer = setInterval(() => send({ type: "ping" }), 30000)
}
function stopPing() {
  clearInterval(pingTimer)
}

export function disconnect() {
  stopPing()
  socket?.close()
  socket = null
}
