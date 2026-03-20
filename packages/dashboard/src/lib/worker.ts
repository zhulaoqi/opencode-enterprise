import { createSignal } from "solid-js"
import { api } from "./api"

const [ready, setReady] = createSignal(false)
export { ready }

let inflight: Promise<void> | null = null

export async function connect() {
  if (ready()) return
  if (inflight) return inflight
  inflight = api
    .get<{ url: string }>("/worker/connect")
    .then(() => {
      setReady(true)
      console.log("[worker] ready (via platform proxy)")
    })
    .finally(() => { inflight = null })
  return inflight
}

export function reset() {
  setReady(false)
  inflight = null
}

export async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  if (!ready()) await connect()
  const res = await fetch(`/api/worker/proxy${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...api.authHeader(),
      ...opts?.headers,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function sseUrl(path: string): string {
  return `/api/worker/proxy${path}`
}
