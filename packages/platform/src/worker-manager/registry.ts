import { redis } from "@/redis"

const PREFIX = "worker:"

type Entry = {
  port: number
  pid: number
  container: string
  secret: string
  started: number
  active: number
}

export type { Entry }

export async function get(uid: string): Promise<Entry | null> {
  const raw = await redis().get(PREFIX + uid)
  return raw ? JSON.parse(raw) : null
}

export async function set(uid: string, entry: Entry) {
  await redis().set(PREFIX + uid, JSON.stringify(entry), "EX", 7200)
}

export async function touch(uid: string) {
  const entry = await get(uid)
  if (!entry) return
  entry.active = Date.now()
  await set(uid, entry)
}

export async function del(uid: string) {
  await redis().del(PREFIX + uid)
}

export async function all(): Promise<[string, Entry][]> {
  const keys = await redis().keys(PREFIX + "*")
  const result: [string, Entry][] = []
  for (const key of keys) {
    if (key === "worker:_port") continue
    const raw = await redis().get(key)
    if (raw) result.push([key.slice(PREFIX.length), JSON.parse(raw)])
  }
  return result
}

export async function allocate(): Promise<number> {
  const next = await redis().incr("worker:_port")
  return 4200 + (next % 10000)
}
