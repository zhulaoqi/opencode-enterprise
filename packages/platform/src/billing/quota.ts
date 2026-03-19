import { redis } from "@/redis"
import { eq } from "drizzle-orm"
import { quota_config } from "./quota.sql"
import type { Database } from "@/db"

export function periodKey(period: string, date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return period === "daily" ? `${y}-${m}-${d}` : `${y}-${m}`
}

function redisKey(scope: string, id: string, key: string, metric: string) {
  return `quota:${scope}:${id}:${key}:${metric}`
}

export async function checkQuota(
  db: Database,
  checks: { userId: string; deptIds: string[] },
): Promise<{ allowed: boolean; reason?: string }> {
  const r = redis()
  const now = new Date()

  const configs = await db.select().from(quota_config).where(eq(quota_config.enabled, true))

  const labels: Record<string, string> = {
    user: "您的个人",
    department: "部门",
    global: "全局",
  }

  for (const cfg of configs) {
    const key = periodKey(cfg.period, now)

    const isRelevant =
      cfg.scope_type === "global" ||
      (cfg.scope_type === "user" && cfg.scope_id === checks.userId) ||
      (cfg.scope_type === "department" && checks.deptIds.includes(cfg.scope_id))

    if (!isRelevant) continue

    const prefix = labels[cfg.scope_type] ?? ""
    const span = cfg.period === "daily" ? "今日" : "本月"

    const rk = redisKey(cfg.scope_type, cfg.scope_id, key, "tokens")
    const used = Number((await r.get(rk)) ?? "0")
    if (used >= cfg.max_tokens) {
      return {
        allowed: false,
        reason: `${prefix}${span} Token 配额已用完 (${used.toLocaleString()} / ${cfg.max_tokens.toLocaleString()})`,
      }
    }

    if (cfg.max_requests) {
      const rk2 = redisKey(cfg.scope_type, cfg.scope_id, key, "requests")
      const reqs = Number((await r.get(rk2)) ?? "0")
      if (reqs >= cfg.max_requests) {
        return {
          allowed: false,
          reason: `${prefix}${span}请求次数配额已用完 (${reqs.toLocaleString()} / ${cfg.max_requests.toLocaleString()})`,
        }
      }
    }

    if (cfg.max_cost_usd) {
      const rk3 = redisKey(cfg.scope_type, cfg.scope_id, key, "cost")
      const cost = Number((await r.get(rk3)) ?? "0")
      const limit = Number(cfg.max_cost_usd)
      if (cost >= limit) {
        return {
          allowed: false,
          reason: `${prefix}${span}费用配额已用完 ($${cost.toFixed(2)} / $${limit.toFixed(2)})`,
        }
      }
    }
  }

  return { allowed: true }
}

export async function increment(
  scope: string,
  id: string,
  period: string,
  input: number,
  output: number,
  cost: number,
) {
  const r = redis()
  const key = periodKey(period)
  const total = input + output
  const pipeline = r.pipeline()
  pipeline.incrby(redisKey(scope, id, key, "tokens"), total)
  pipeline.incrby(redisKey(scope, id, key, "input"), input)
  pipeline.incrby(redisKey(scope, id, key, "output"), output)
  pipeline.incr(redisKey(scope, id, key, "requests"))
  pipeline.incrbyfloat(redisKey(scope, id, key, "cost"), cost)
  const ttl = period === "daily" ? 86400 * 2 : 86400 * 35
  for (const m of ["tokens", "input", "output", "requests", "cost"])
    pipeline.expire(redisKey(scope, id, key, m), ttl)
  await pipeline.exec()
}

export type Usage = {
  tokens: number
  input: number
  output: number
  requests: number
  cost: number
}

export async function usage(scope: string, id: string, period: string): Promise<Usage> {
  const r = redis()
  const key = periodKey(period)
  const [tokens, input, output, requests, cost] = await Promise.all([
    r.get(redisKey(scope, id, key, "tokens")),
    r.get(redisKey(scope, id, key, "input")),
    r.get(redisKey(scope, id, key, "output")),
    r.get(redisKey(scope, id, key, "requests")),
    r.get(redisKey(scope, id, key, "cost")),
  ])
  return {
    tokens: Number(tokens ?? 0),
    input: Number(input ?? 0),
    output: Number(output ?? 0),
    requests: Number(requests ?? 0),
    cost: Number(cost ?? 0),
  }
}

export function listConfigs(db: Database) {
  return db.select().from(quota_config)
}

export async function upsertConfig(db: Database, input: typeof quota_config.$inferInsert) {
  const [row] = await db
    .insert(quota_config)
    .values(input)
    .onConflictDoUpdate({
      target: [quota_config.scope_type, quota_config.scope_id, quota_config.period],
      set: {
        max_tokens: input.max_tokens,
        max_requests: input.max_requests,
        max_cost_usd: input.max_cost_usd,
        enabled: input.enabled,
        updated_at: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error("quota upsert failed")
  return row
}
