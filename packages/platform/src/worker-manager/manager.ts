import * as registry from "./registry"
import { serialize } from "./config"
import path from "path"

const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname)

const HEALTH_TIMEOUT = 5000
const SPAWN_TIMEOUT = 30000
const BOOTSTRAP = new URL("./bootstrap.ts", import.meta.url).pathname
const MODE = process.env.WORKER_MODE ?? "process"
const pending = new Map<string, Promise<Worker>>()

type Worker = { port: number; secret: string; container: string }

async function healthy(port: number): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT)
  try {
    const res = await fetch(`http://localhost:${port}/global/health`, { signal: ctrl.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function ready(port: number, timeout = SPAWN_TIMEOUT): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await healthy(port)) return
    await Bun.sleep(500)
  }
  throw new Error(`Worker on :${port} did not become healthy within ${timeout}ms`)
}

async function spawnProcess(uid: string, port: number, secret: string, config: string) {
  const dir = path.join(process.env.WORKER_DATA ?? path.join(ROOT, ".workers"), uid)
  const proc = Bun.spawn(["bun", "run", BOOTSTRAP], {
    env: {
      ...process.env,
      WORKER_USER_ID: uid,
      WORKER_PORT: String(port),
      WORKER_DIR: dir,
      WORKER_SECRET: secret,
      WORKER_CONFIG: config,
    },
    stdout: "inherit",
    stderr: "inherit",
  })
  return { pid: proc.pid, container: "" }
}

async function spawnDocker(uid: string, port: number, secret: string, config: string) {
  const name = `worker-${uid.slice(0, 8)}`
  const proc = Bun.spawn(["docker", "run", "-d",
    "--name", name,
    "--network", "host",
    "-e", `WORKER_USER_ID=${uid}`,
    "-e", `WORKER_PORT=${port}`,
    "-e", `WORKER_SECRET=${secret}`,
    "-e", `WORKER_CONFIG=${config}`,
    "-e", `DATABASE_URL=${process.env.DATABASE_URL}`,
    "-e", `REDIS_URL=${process.env.REDIS_URL}`,
    "-v", `/data/workers/${uid}:/data/workers/${uid}`,
    "opencode-worker",
  ], { stdout: "pipe" })
  const output = await new Response(proc.stdout).text()
  return { pid: 0, container: output.trim() }
}

export async function spawn(uid: string): Promise<Worker> {
  const port = await registry.allocate()
  const secret = crypto.randomUUID()
  const config = await serialize(uid)

  const result = MODE === "docker"
    ? await spawnDocker(uid, port, secret, config)
    : await spawnProcess(uid, port, secret, config)

  await ready(port)
  await registry.set(uid, {
    port,
    pid: result.pid,
    container: result.container,
    secret,
    started: Date.now(),
    active: Date.now(),
  })
  console.log(`[worker-manager] spawned uid=${uid} port=${port} mode=${MODE}`)
  return { port, secret, container: result.container }
}

export async function get(uid: string): Promise<Worker> {
  const existing = await registry.get(uid)
  if (existing && await healthy(existing.port)) {
    await registry.touch(uid)
    return { port: existing.port, secret: existing.secret, container: existing.container }
  }
  if (existing) await registry.del(uid)
  const inflight = pending.get(uid)
  if (inflight) return inflight
  const p = spawn(uid).finally(() => pending.delete(uid))
  pending.set(uid, p)
  return p
}

export async function stop(uid: string) {
  const entry = await registry.get(uid)
  if (!entry) return
  try { await fetch(`http://localhost:${entry.port}/global/dispose`, { method: "POST" }) } catch {}
  if (entry.container) {
    Bun.spawn(["docker", "stop", entry.container])
    Bun.spawn(["docker", "rm", "-f", entry.container])
  } else if (entry.pid) {
    setTimeout(() => { try { process.kill(entry.pid, "SIGTERM") } catch {} }, 5000)
  }
  await registry.del(uid)
  console.log(`[worker-manager] stopped uid=${uid}`)
}
