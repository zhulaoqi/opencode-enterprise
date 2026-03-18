import { redis } from "@/redis"
import { database } from "@/db"
import { quota_usage } from "./quota.sql"

export async function sync() {
  const r = redis()
  const db = database()
  const keys = await r.keys("quota:*:*:*:tokens")

  for (const key of keys) {
    const parts = key.split(":")
    const [, scope, id, period] = parts
    if (!scope || !id || !period) continue
    const [tokens, requests, cost] = await Promise.all([
      r.get(key),
      r.get(key.replace(":tokens", ":requests")),
      r.get(key.replace(":tokens", ":cost")),
    ])
    const vals = {
      scope_type: scope,
      scope_id: id,
      period_key: period,
      tokens_used: Number(tokens ?? 0),
      requests_count: Number(requests ?? 0),
      cost_usd: String(cost ?? "0"),
    }
    await db
      .insert(quota_usage)
      .values(vals)
      .onConflictDoUpdate({
        target: [quota_usage.scope_type, quota_usage.scope_id, quota_usage.period_key],
        set: {
          tokens_used: vals.tokens_used,
          requests_count: vals.requests_count,
          cost_usd: vals.cost_usd,
          updated_at: new Date(),
        },
      })
  }
}

let timer: ReturnType<typeof setInterval> | undefined

export function start(interval = 60_000) {
  timer = setInterval(sync, interval)
}

export function stop() {
  if (timer) clearInterval(timer)
}
