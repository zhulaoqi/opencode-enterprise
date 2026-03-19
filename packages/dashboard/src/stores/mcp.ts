import { createSignal } from "solid-js"
import { api } from "../lib/api"

export type McpItem = {
  id: string
  name: string
  display_name: string
  description?: string
  visibility: string
  tags?: string[]
  health_status?: string
  accessible?: boolean
  authorized?: boolean
  owner_id?: string
  tool_count?: number
  daily_calls?: number
  authorized_count?: number
  owner_name?: string
}

const [mcps, setMcps] = createSignal<McpItem[]>([])
const [loading, setLoading] = createSignal(false)
const [error, setError] = createSignal<string | null>(null)

export { mcps, setMcps, loading, setLoading, error, setError }

export async function loadMarket() {
  setLoading(true)
  setError(null)
  try {
    const res = await api.get<{ mcps: McpItem[] }>("/mcp/market")
    setMcps(res.mcps ?? [])
  } catch (e) {
    setError(String(e))
  } finally {
    setLoading(false)
  }
}

export function filterByVisibility(items: McpItem[], tab: string, ownerId?: string): McpItem[] {
  if (tab === "all") return items
  if (tab === "PRIVATE" && ownerId) return items.filter((m) => m.owner_id === ownerId)
  return items.filter((m) => m.visibility === tab)
}

export function filterByTag(items: McpItem[], tag: string): McpItem[] {
  if (!tag) return items
  return items.filter((m) => (m.tags ?? []).includes(tag))
}

export function filterBySearch(items: McpItem[], q: string): McpItem[] {
  if (!q.trim()) return items
  const s = q.toLowerCase()
  return items.filter(
    (m) =>
      (m.display_name ?? "").toLowerCase().includes(s) ||
      (m.name ?? "").toLowerCase().includes(s) ||
      (m.description ?? "").toLowerCase().includes(s)
  )
}
