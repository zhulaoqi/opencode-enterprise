import { redis } from "@/redis"

export namespace slidingWindow {
  export function key(scope: string, id: string, metric: string) {
    return `ratelimit:${scope}:${id}:${metric}`
  }

  export async function check(opts: {
    key: string
    limit: number
    window: number
  }): Promise<{ allowed: boolean; remaining: number; reset: number }> {
    const r = redis()
    const now = Date.now()
    const min = now - opts.window * 1000
    const k = opts.key

    const pipeline = r.pipeline()
    pipeline.zremrangebyscore(k, "-inf", String(min))
    pipeline.zcard(k)
    pipeline.zadd(k, now, `${now}:${Math.random()}`)
    pipeline.expire(k, opts.window + 1)
    const results = await pipeline.exec()

    const count = (results?.[1]?.[1] as number) ?? 0
    const allowed = count < opts.limit
    if (!allowed) {
      await r.zrem(k, `${now}:${Math.random()}`)
    }

    return {
      allowed,
      remaining: Math.max(0, opts.limit - count - (allowed ? 1 : 0)),
      reset: Math.ceil((min + opts.window * 1000 - now) / 1000),
    }
  }

  export async function checkConcurrency(opts: {
    key: string
    limit: number
    ttl: number
  }): Promise<{ allowed: boolean; active: number }> {
    const r = redis()
    const active = await r.scard(opts.key)
    return { allowed: active < opts.limit, active }
  }

  export async function acquireConcurrency(key: string, id: string, ttl: number) {
    const r = redis()
    await r.sadd(key, id)
    await r.expire(key, ttl)
  }

  export async function releaseConcurrency(key: string, id: string) {
    await redis().srem(key, id)
  }
}

export type RateLimitConfig = {
  rpm: number
  concurrency: number
}

const defaults: Record<string, RateLimitConfig> = {
  default: { rpm: 20, concurrency: 3 },
  admin: { rpm: 100, concurrency: 10 },
  manager: { rpm: 50, concurrency: 5 },
}

export function configForRole(roles: string[]): RateLimitConfig {
  if (roles.includes("admin")) return defaults.admin
  if (roles.includes("manager")) return defaults.manager
  return defaults.default
}
