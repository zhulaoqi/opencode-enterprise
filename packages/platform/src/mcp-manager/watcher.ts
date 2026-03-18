import { subscriber, redis } from "@/redis"
import { toolChangePrompt } from "./prompt"

type ChangeEvent = {
  user_id: string
  added: string[]
  removed: string[]
}

type Listener = (event: ChangeEvent) => void

const listeners = new Map<string, Set<Listener>>()
let subscribed = false
const debounce = new Map<string, ReturnType<typeof setTimeout>>()

export function onChange(userId: string, fn: Listener): () => void {
  if (!listeners.has(userId)) listeners.set(userId, new Set())
  listeners.get(userId)!.add(fn)
  ensureSubscribed()
  return () => {
    listeners.get(userId)?.delete(fn)
    if (listeners.get(userId)?.size === 0) listeners.delete(userId)
  }
}

function ensureSubscribed() {
  if (subscribed) return
  subscribed = true
  const sub = subscriber()
  sub.psubscribe("mcp:change:*")
  sub.on("pmessage", (_pattern, channel, message) => {
    const userId = channel.replace("mcp:change:", "")
    const existing = debounce.get(userId)
    if (existing) clearTimeout(existing)
    debounce.set(
      userId,
      setTimeout(() => {
        debounce.delete(userId)
        const event = JSON.parse(message) as ChangeEvent
        const fns = listeners.get(userId)
        if (fns) for (const fn of fns) fn(event)
      }, 300),
    )
  })
}

export async function publish(userId: string, added: string[], removed: string[]) {
  const event: ChangeEvent = { user_id: userId, added, removed }
  await redis().publish(`mcp:change:${userId}`, JSON.stringify(event))
}

export async function publishToAll(added: string[], removed: string[]) {
  const event: ChangeEvent = { user_id: "*", added, removed }
  await redis().publish("mcp:change:*", JSON.stringify(event))
}

export function generatePrompt(event: ChangeEvent): string {
  return toolChangePrompt(event.added, event.removed)
}
