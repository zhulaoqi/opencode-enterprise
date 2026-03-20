import * as registry from "./registry"
import * as manager from "./manager"

const MAX = parseInt(process.env.MAX_WORKERS ?? "200")
const IDLE = parseInt(process.env.WORKER_IDLE_MS ?? "1800000")
const INTERVAL = 60_000

export function start() {
  setInterval(sweep, INTERVAL)
  console.log(`[pool] started max=${MAX} idle=${IDLE}ms`)
}

async function sweep() {
  const workers = await registry.all()
  const now = Date.now()
  let stopped = 0

  for (const [uid, entry] of workers) {
    if (now - entry.active > IDLE) {
      await manager.stop(uid)
      stopped++
    }
  }

  const remaining = await registry.all()
  if (remaining.length > MAX) {
    const sorted = remaining.sort((a, b) => a[1].active - b[1].active)
    const evict = sorted.slice(0, remaining.length - MAX)
    for (const [uid] of evict) {
      await manager.stop(uid)
      stopped++
    }
  }

  if (stopped) console.log(`[pool] swept ${stopped} workers`)
}
