import { createSignal } from "solid-js"
import { api } from "./api"

export type Status = "disconnected" | "connecting" | "ready"
export type Reason = "none" | "worker_down" | "platform_maintenance" | "platform_unreachable"

const BACKOFF = [2000, 4000, 8000, 16000, 30000]
const MAX_RETRIES = 8

const [status, setStatus] = createSignal<Status>("disconnected")
const [attempts, setAttempts] = createSignal(0)
const [reason, setReason] = createSignal<Reason>("none")
export { status, attempts, reason }

export const ready = () => status() === "ready"
export const exhausted = () => attempts() >= MAX_RETRIES

let inflight: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | null = null

export function markReady() {
  setStatus("ready")
  setAttempts(0)
  setReason("none")
  if (timer) { clearTimeout(timer); timer = null }
}

export function markDisconnected() {
  if (status() === "disconnected") return
  setStatus("disconnected")
  schedule()
}

function delay() {
  return BACKOFF[Math.min(attempts(), BACKOFF.length - 1)]
}

function schedule() {
  if (timer || inflight) return
  if (attempts() >= MAX_RETRIES) {
    console.warn(`[worker] max retries (${MAX_RETRIES}) reached, waiting for manual retry`)
    return
  }
  const ms = delay()
  console.log(`[worker] retry #${attempts() + 1} in ${ms}ms`)
  timer = setTimeout(() => {
    timer = null
    connect()
  }, ms)
}

export function retryNow() {
  setAttempts(0)
  if (timer) { clearTimeout(timer); timer = null }
  connect()
}

export async function connect() {
  if (status() === "ready") return
  if (inflight) return inflight
  setStatus("connecting")
  setAttempts((n) => n + 1)
  inflight = (async () => {
    try {
      const res = await fetch("/api/worker/connect", {
        headers: { ...api.authHeader() },
      })
      if (res.status === 502) {
        setReason("worker_down")
        setStatus("disconnected")
        schedule()
        return
      }
      if (res.status === 503) {
        setReason("platform_maintenance")
        setStatus("disconnected")
        schedule()
        return
      }
      if (!res.ok) {
        setReason("worker_down")
        setStatus("disconnected")
        schedule()
        return
      }
      console.log("[worker] connect ok, opening SSE...")
      const { connect: sseConnect } = await import("./stream")
      sseConnect()
    } catch {
      setReason("platform_unreachable")
      setStatus("disconnected")
      schedule()
    }
  })()
  inflight = inflight.finally(() => { inflight = null })
  return inflight
}

export function reset() {
  if (timer) { clearTimeout(timer); timer = null }
  setStatus("disconnected")
  inflight = null
}

export async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  if (status() !== "ready") await connect()
  let res: Response
  try {
    res = await fetch(`/api/worker/proxy${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...api.authHeader(),
        ...opts?.headers,
      },
    })
  } catch {
    setReason("platform_unreachable")
    reset()
    schedule()
    throw new Error("Worker unavailable, reconnecting...")
  }
  if (res.status === 502) {
    setReason("worker_down")
    reset()
    schedule()
    throw new Error("Worker unavailable, reconnecting...")
  }
  if (res.status === 503) {
    setReason("platform_maintenance")
    reset()
    schedule()
    throw new Error("Worker unavailable, reconnecting...")
  }
  if (!res.ok) throw new Error(await res.text())
  const txt = await res.text()
  if (!txt) return undefined as T
  return JSON.parse(txt)
}

export function sseUrl(path: string): string {
  return `/api/worker/proxy${path}`
}
