import { createSignal } from "solid-js"
import { api } from "./api"

const [url, setUrl] = createSignal("")
const [secret, setSecret] = createSignal("")
const [ready, setReady] = createSignal(false)

export { url, ready }

let inflight: Promise<void> | null = null

export async function connect() {
  if (ready()) return
  if (inflight) return inflight
  inflight = api
    .get<{ url: string; token: string }>("/worker/connect")
    .then((res) => {
      setUrl(res.url)
      setSecret(res.token)
      setReady(true)
      console.log("[worker] connected to", res.url)
    })
    .finally(() => { inflight = null })
  return inflight
}

export function reset() {
  setUrl("")
  setSecret("")
  setReady(false)
  inflight = null
}

function headers(): HeadersInit {
  const s = secret()
  if (!s) return {}
  return { Authorization: `Basic ${btoa(`:${s}`)}` }
}

export async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  if (!ready()) await connect()
  const base = url()
  if (!base) throw new Error("Worker not connected")
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...headers(), ...opts?.headers },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function sseUrl(path: string): string {
  const base = url()
  const s = secret()
  return `${base}${path}${path.includes("?") ? "&" : "?"}password=${s}`
}
