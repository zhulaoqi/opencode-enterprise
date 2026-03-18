import { redis } from "@/redis"

export type CircuitState = {
  state: "CLOSED" | "OPEN" | "HALF_OPEN"
  failures: number
  last_failure: number
  last_success: number
  opened_at: number
}

const PREFIX = "circuit:"
const THRESHOLD = 0.1
const COOLDOWN = 30_000
const PROBE_SUCCESSES = 3

function key(mcp: string) {
  return PREFIX + mcp
}

export async function state(mcp: string): Promise<CircuitState> {
  const raw = await redis().hgetall(key(mcp))
  if (!raw.state)
    return { state: "CLOSED", failures: 0, last_failure: 0, last_success: 0, opened_at: 0 }
  return {
    state: raw.state as CircuitState["state"],
    failures: Number(raw.failures ?? 0),
    last_failure: Number(raw.last_failure ?? 0),
    last_success: Number(raw.last_success ?? 0),
    opened_at: Number(raw.opened_at ?? 0),
  }
}

export async function allowed(mcp: string): Promise<{ ok: boolean; message?: string }> {
  const s = await state(mcp)
  const now = Date.now()

  if (s.state === "CLOSED") return { ok: true }

  if (s.state === "OPEN") {
    if (now - s.opened_at > COOLDOWN) {
      await redis().hset(key(mcp), "state", "HALF_OPEN")
      return { ok: true }
    }
    return { ok: false, message: `${mcp} 服务当前繁忙（响应超时），请稍后重试` }
  }

  return { ok: true }
}

export async function success(mcp: string) {
  const r = redis()
  const s = await state(mcp)
  await r.hset(key(mcp), "last_success", Date.now())

  if (s.state === "HALF_OPEN") {
    const successes = Number((await r.hget(key(mcp), "probe_successes")) ?? 0) + 1
    await r.hset(key(mcp), "probe_successes", successes)
    if (successes >= PROBE_SUCCESSES) {
      await r.hset(key(mcp), "state", "CLOSED", "failures", 0, "probe_successes", 0)
    }
  }
}

export async function failure(mcp: string) {
  const r = redis()
  const s = await state(mcp)
  const failures = s.failures + 1
  await r.hset(key(mcp), "failures", failures, "last_failure", Date.now())

  if (s.state === "HALF_OPEN") {
    await r.hset(key(mcp), "state", "OPEN", "opened_at", Date.now(), "probe_successes", 0)
    return
  }

  const total = (await r.get(`circuit:${mcp}:total`)) ?? "0"
  if (Number(total) > 10 && failures / Number(total) > THRESHOLD) {
    await r.hset(key(mcp), "state", "OPEN", "opened_at", Date.now())
  }
}

export async function recordCall(mcp: string) {
  const r = redis()
  const tk = `circuit:${mcp}:total`
  await r.incr(tk)
  await r.expire(tk, 120)
}
