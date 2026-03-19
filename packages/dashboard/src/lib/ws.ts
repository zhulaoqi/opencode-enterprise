import { createSignal } from "solid-js"
import { token } from "../stores/auth"

type WsMsg = Record<string, unknown>
type Handler = (msg: WsMsg) => void

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const handlers = new Map<string, Set<Handler>>()
let socket: WebSocket | null = null
let retries = 0
let closing = false

const MAX_RETRIES = Infinity
const BASE_DELAY = 1000
const MAX_DELAY = 30_000
const PING_INTERVAL = 25_000
const PONG_TIMEOUT = 10_000
const BUFFER_LIMIT = 200

const [connected, setConnected] = createSignal(false)
const [reconnecting, setReconnecting] = createSignal(false)
const [latency, setLatency] = createSignal(0)

export { connected, reconnecting, latency }

// ---------------------------------------------------------------------------
// Offline message buffer — queued while disconnected, flushed on reconnect
// ---------------------------------------------------------------------------
let buffer: string[] = []

function flush() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  const pending = buffer.splice(0)
  for (const raw of pending) {
    try { socket.send(raw) } catch { buffer.unshift(raw) ; break }
  }
}

// ---------------------------------------------------------------------------
// Heartbeat — client pings, expects pong within timeout
// ---------------------------------------------------------------------------
let pingTimer: ReturnType<typeof setInterval>
let pongTimer: ReturnType<typeof setTimeout>
let pingSent = 0

function startHeartbeat() {
  stopHeartbeat()
  pingTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    pingSent = Date.now()
    socket.send(JSON.stringify({ type: "ping" }))
    pongTimer = setTimeout(() => {
      console.warn("[ws] pong timeout, forcing reconnect")
      socket?.close(4000, "pong timeout")
    }, PONG_TIMEOUT)
  }, PING_INTERVAL)
}

function stopHeartbeat() {
  clearInterval(pingTimer)
  clearTimeout(pongTimer)
}

function onPong() {
  clearTimeout(pongTimer)
  if (pingSent) setLatency(Date.now() - pingSent)
}

// ---------------------------------------------------------------------------
// Reconnect delay — exponential backoff with jitter
// ---------------------------------------------------------------------------
let reconnectTimer: ReturnType<typeof setTimeout>

function delay() {
  const exp = Math.min(BASE_DELAY * Math.pow(2, retries), MAX_DELAY)
  return exp * (0.5 + Math.random() * 0.5)
}

function scheduleReconnect() {
  if (closing || !token()) return
  clearTimeout(reconnectTimer)
  const ms = delay()
  console.log(`[ws] reconnecting in ${Math.round(ms)}ms (attempt ${retries + 1})`)
  setReconnecting(true)
  reconnectTimer = setTimeout(() => {
    if (!token()) return
    retries++
    connect()
  }, ms)
}

// ---------------------------------------------------------------------------
// Page visibility — reconnect immediately when tab becomes visible
// ---------------------------------------------------------------------------
function onVisibility() {
  if (document.visibilityState !== "visible") return
  if (socket && socket.readyState === WebSocket.OPEN) return
  console.log("[ws] tab visible, reconnecting now")
  clearTimeout(reconnectTimer)
  retries = 0
  connect()
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onVisibility)
}

// ---------------------------------------------------------------------------
// Network awareness — reconnect when browser comes back online
// ---------------------------------------------------------------------------
function onOnline() {
  if (socket && socket.readyState === WebSocket.OPEN) return
  console.log("[ws] network online, reconnecting now")
  clearTimeout(reconnectTimer)
  retries = 0
  connect()
}

if (typeof window !== "undefined") {
  window.addEventListener("online", onOnline)
}

// ---------------------------------------------------------------------------
// Core connect
// ---------------------------------------------------------------------------
function wsUrl(tk: string) {
  if (import.meta.env.DEV) return `ws://localhost:3100/ws?token=${tk}`
  const protocol = location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${location.host}/ws?token=${tk}`
}

export function connect() {
  if (closing) return
  const tk = token()
  if (!tk) return
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return

  socket = new WebSocket(wsUrl(tk))

  socket.onopen = () => {
    console.log("[ws] connected")
    setConnected(true)
    setReconnecting(false)
    retries = 0
    startHeartbeat()
    flush()
    emit("_reconnect", {})
  }

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data as string) as WsMsg
      if (msg.type === "pong") { onPong(); return }
      emit(msg.type as string, msg)
    } catch { /* malformed frame */ }
  }

  socket.onclose = (e) => {
    console.log(`[ws] closed code=${e.code} reason=${e.reason}`)
    setConnected(false)
    stopHeartbeat()
    emit("_disconnect", {})
    if (!closing) scheduleReconnect()
  }

  socket.onerror = () => {
    socket?.close()
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function send(msg: WsMsg) {
  const raw = JSON.stringify(msg)
  if (socket && socket.readyState === WebSocket.OPEN) {
    try { socket.send(raw) } catch { buffer.push(raw) }
  } else {
    if (buffer.length < BUFFER_LIMIT) buffer.push(raw)
  }
}

export function on(type: string, fn: Handler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set())
  handlers.get(type)!.add(fn)
  return () => { handlers.get(type)?.delete(fn) }
}

export function disconnect() {
  closing = true
  clearTimeout(reconnectTimer)
  stopHeartbeat()
  buffer = []
  socket?.close(1000, "client disconnect")
  socket = null
  setConnected(false)
  setReconnecting(false)
}

export function reconnect() {
  closing = false
  retries = 0
  socket?.close()
  socket = null
  connect()
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------
function emit(type: string, msg: WsMsg) {
  const fns = handlers.get(type)
  if (fns) for (const fn of fns) fn(msg)
}
