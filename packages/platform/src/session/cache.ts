import { redis } from "@/redis"

const TTL = 1800
const PREFIX = "session:"

export async function get(id: string): Promise<any | null> {
  const raw = await redis().get(PREFIX + id)
  if (!raw) return null
  return JSON.parse(raw)
}

export async function set(id: string, data: any): Promise<void> {
  await redis().setex(PREFIX + id, TTL, JSON.stringify(data))
}

export async function invalidate(id: string): Promise<void> {
  await redis().del(PREFIX + id)
}

export async function extend(id: string): Promise<void> {
  await redis().expire(PREFIX + id, TTL)
}
