import Redis from "ioredis"
import { env } from "@/env"

let client: Redis | undefined
let sub: Redis | undefined

export function redis(): Redis {
  if (client) return client
  client = new Redis(env().REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 5000)
    },
    lazyConnect: true,
  })
  return client
}

export function subscriber(): Redis {
  if (sub) return sub
  sub = redis().duplicate()
  return sub
}

export async function close() {
  if (client) await client.quit()
  if (sub) await sub.quit()
  client = undefined
  sub = undefined
}
