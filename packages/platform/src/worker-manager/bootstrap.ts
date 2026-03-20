import { setUserId } from "../hooks/context"
import { register } from "../hooks/register"
import { existsSync, appendFileSync } from "fs"
import { mkdir } from "fs/promises"
import path from "path"
import Redis from "ioredis"

const uid = process.env.WORKER_USER_ID
const port = parseInt(process.env.WORKER_PORT ?? "4200")
const secret = process.env.WORKER_SECRET ?? ""
const dir = process.env.WORKER_DIR ?? path.join("/tmp", `opencode-worker-${uid}`)

if (!uid) {
  console.error("[bootstrap] WORKER_USER_ID is required")
  process.exit(1)
}

await mkdir(dir, { recursive: true })

const logfile = path.join(dir, "worker.log")
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  appendFileSync(logfile, line)
}

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
const srv = Server.listen({ port, hostname: "0.0.0.0" })
log(`uid=${uid} dir=${dir} listening on :${srv.port}`)

let mredis: InstanceType<typeof Redis> | null = null
function mconn() {
  if (mredis) return mredis
  mredis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379")
  return mredis
}

const started = Date.now()
let prev = process.cpuUsage()
let fails = 0
let active = Date.now()

const INTERVAL = 10_000
const MAX_FAILS = 30
const MAX_IDLE = 7_200_000
const MAX_UPTIME = 86_400_000
const REG_TTL = 7200

async function tombstone(reason: string) {
  try {
    await mconn().set(`worker:tombstone:${uid}`, JSON.stringify({ reason, ts: Date.now() }), "EX", 3600)
  } catch {}
}

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
      if (sessions > 0) active = Date.now()
    }
  } catch {}
  const pct = Math.round((cur.user + cur.system) / 1000 / INTERVAL * 100 * 10) / 10
  const metrics = JSON.stringify({
    cpu: pct,
    rss: Math.round(mem.rss / 1024 / 1024),
    heap: Math.round(mem.heapUsed / 1024 / 1024),
    sessions,
    tokens: { input: 0, output: 0 },
    ts: Date.now(),
  })
  const entry = JSON.stringify({
    port,
    pid: process.pid,
    container: "",
    secret,
    started,
    active,
  })

  try {
    const r = mconn()
    await r.set(`worker:metrics:${uid}`, metrics, "EX", 30)
    await r.set(`worker:${uid}`, entry, "EX", REG_TTL)
    fails = 0
  } catch {
    fails++
    log(`redis write failed (${fails}/${MAX_FAILS})`)
  }

  const now = Date.now()
  if (fails >= MAX_FAILS) {
    log(`terminating: redis unreachable ${fails} times`)
    await tombstone("redis_unreachable")
    process.exit(0)
  }
  if (now - active > MAX_IDLE) {
    log(`terminating: idle for ${Math.round((now - active) / 60_000)}m`)
    await tombstone("idle")
    process.exit(0)
  }
  if (now - started > MAX_UPTIME) {
    log(`terminating: max uptime ${Math.round((now - started) / 3_600_000)}h`)
    await tombstone("max_uptime")
    process.exit(0)
  }
}

setInterval(report, INTERVAL)

await new Promise(() => {})
