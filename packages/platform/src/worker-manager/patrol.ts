import * as registry from "./registry"
import * as manager from "./manager"

const INTERVAL = 30_000
const THRESHOLD = 3
const MAX_RESTARTS = 3

type State = { fails: number; restarts: number; hour: number }

const state = new Map<string, State>()
let timer: ReturnType<typeof setInterval> | null = null

function hour() {
  return Math.floor(Date.now() / 3_600_000)
}

function get(uid: string): State {
  let s = state.get(uid)
  if (!s) { s = { fails: 0, restarts: 0, hour: hour() }; state.set(uid, s) }
  if (s.hour !== hour()) { s.restarts = 0; s.hour = hour() }
  return s
}

async function check() {
  let entries: [string, registry.Entry][]
  try {
    entries = await registry.all()
  } catch {
    return
  }
  const seen = new Set<string>()
  for (const [uid, entry] of entries) {
    seen.add(uid)
    const s = get(uid)
    const ok = await manager.healthy(entry.port)
    if (ok) {
      s.fails = 0
      continue
    }
    s.fails++
    if (s.fails < THRESHOLD) continue
    console.log(`[patrol] uid=${uid} unhealthy ${s.fails} times, attempting restart`)
    if (s.restarts >= MAX_RESTARTS) {
      console.warn(`[patrol] uid=${uid} max restarts (${MAX_RESTARTS}/h) reached, skipping`)
      continue
    }
    try {
      await manager.stop(uid)
      await manager.spawn(uid)
      s.fails = 0
      s.restarts++
      console.log(`[patrol] uid=${uid} restarted (${s.restarts}/${MAX_RESTARTS} this hour)`)
    } catch (e) {
      console.error(`[patrol] uid=${uid} restart failed:`, e)
    }
  }
  for (const uid of state.keys()) {
    if (!seen.has(uid)) state.delete(uid)
  }
}

export function start() {
  if (timer) return
  timer = setInterval(check, INTERVAL)
  console.log("[patrol] started, interval=30s")
}

export function stop() {
  if (timer) { clearInterval(timer); timer = null }
}
