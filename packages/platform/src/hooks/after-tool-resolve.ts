import type { Tool } from "ai"
import { database } from "@/db"
import * as resolver from "@/mcp-manager/resolver"

export async function afterToolResolve(input: {
  sessionID: string
  userId?: string
  tools: Record<string, Tool>
}) {
  if (!input.userId) return input
  const db = database()
  const resolved = await resolver.resolve(db, { internal_id: input.userId })
  const names = new Set(resolved.map((m) => m.name))

  const filtered: Record<string, Tool> = {}
  for (const [key, tool] of Object.entries(input.tools)) {
    const prefix = key.split("_")[0] ?? ""
    if (names.has(prefix)) filtered[key] = tool
  }
  return { ...input, tools: filtered }
}
