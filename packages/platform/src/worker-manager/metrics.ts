import { redis } from "@/redis"

const PREFIX = "worker:metrics:"
const TTL = 30

export type Metrics = {
  cpu: number
  rss: number
  heap: number
  sessions: number
  tokens: { input: number; output: number }
  ts: number
}

export async function write(uid: string, data: Metrics) {
  await redis().set(PREFIX + uid, JSON.stringify(data), "EX", TTL)
}

export async function read(uid: string): Promise<Metrics | null> {
  const raw = await redis().get(PREFIX + uid)
  return raw ? JSON.parse(raw) : null
}

export async function all(): Promise<[string, Metrics][]> {
  const keys = await redis().keys(PREFIX + "*")
  const result: [string, Metrics][] = []
  for (const key of keys) {
    const raw = await redis().get(key)
    if (raw) result.push([key.slice(PREFIX.length), JSON.parse(raw)])
  }
  return result
}
