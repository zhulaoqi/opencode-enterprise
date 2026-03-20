import { setUserId } from "../hooks/context"
import { register } from "../hooks/register"
import { existsSync } from "fs"
import { mkdir } from "fs/promises"
import path from "path"
import Redis from "ioredis"

const uid = process.env.WORKER_USER_ID
const port = parseInt(process.env.WORKER_PORT ?? "4200")
const dir = process.env.WORKER_DIR ?? path.join("/tmp", `opencode-worker-${uid}`)

if (!uid) {
  console.error("[bootstrap] WORKER_USER_ID is required")
  process.exit(1)
}

await mkdir(dir, { recursive: true })
if (!existsSync(path.join(dir, ".git"))) {
  Bun.spawnSync(["git", "init"], { cwd: dir, stdout: "ignore", stderr: "ignore" })
  Bun.spawnSync(["git", "commit", "--allow-empty", "-m", "init"], {
    cwd: dir,
    stdout: "ignore",
    stderr: "ignore",
    env: { ...process.env, GIT_AUTHOR_NAME: "opencode", GIT_AUTHOR_EMAIL: "bot@opencode.ai", GIT_COMMITTER_NAME: "opencode", GIT_COMMITTER_EMAIL: "bot@opencode.ai" },
  })
}
process.chdir(dir)

process.env.AGENT = "1"
process.env.OPENCODE = "1"
process.env.OPENCODE_PID = String(process.pid)
process.env.OPENCODE_SERVER_PASSWORD = ""

if (process.env.WORKER_CONFIG) {
  process.env.OPENCODE_CONFIG_CONTENT = process.env.WORKER_CONFIG
}

setUserId(uid)
register()

const { Server } = await import("opencode/server/server")
const server = Server.listen({ port, hostname: "0.0.0.0" })
console.log(`[worker] uid=${uid} dir=${dir} listening on :${server.port}`)

let mredis: InstanceType<typeof Redis> | null = null
function mconn() {
  if (mredis) return mredis
  mredis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379")
  return mredis
}

let prev = process.cpuUsage()
const INTERVAL = 10_000

async function report() {
  const cur = process.cpuUsage(prev)
  prev = process.cpuUsage()
  const mem = process.memoryUsage()
  let sessions = 0
  try {
    const res = await fetch(`http://localhost:${port}/session`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const body = await res.json()
      sessions = Array.isArray(body) ? body.length : 0
    }
  } catch {}
  const pct = Math.round((cur.user + cur.system) / 1000 / INTERVAL * 100 * 10) / 10
  const payload = JSON.stringify({
    cpu: pct,
    rss: Math.round(mem.rss / 1024 / 1024),
    heap: Math.round(mem.heapUsed / 1024 / 1024),
    sessions,
    tokens: { input: 0, output: 0 },
    ts: Date.now(),
  })
  try {
    await mconn().set(`worker:metrics:${uid}`, payload, "EX", 30)
  } catch {}
}

setInterval(report, INTERVAL)

await new Promise(() => {})
