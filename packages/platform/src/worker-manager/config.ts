import { database } from "@/db"
import * as resolver from "@/mcp-manager/resolver"
import * as identity from "@/auth/identity"
import { llm_model } from "@/model/model.sql"
import { eq } from "drizzle-orm"

export async function serialize(uid: string) {
  const db = database()

  const [mcps, models, user] = await Promise.all([
    resolver.resolve(db, { internal_id: uid }),
    db.select().from(llm_model).where(eq(llm_model.enabled, true)).orderBy(llm_model.sort_order),
    identity.byInternalId(db, uid),
  ])

  // --- providers & models ---
  const provider: Record<string, unknown> = {}
  const grouped = new Map<string, typeof models>()
  for (const m of models) {
    const key = `${m.base_url}||${m.api_key}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(m)
  }

  const pids: string[] = []
  let primary: string | undefined
  let small: string | undefined
  let idx = 0
  for (const [, group] of grouped) {
    const first = group[0]!
    const pid = `platform_${idx++}`
    pids.push(pid)
    const defs: Record<string, { name: string }> = {}
    for (const m of group) {
      defs[m.model_id] = { name: m.model_id }
      const ref = `${pid}/${m.model_id}`
      if (!primary && m.role === "primary") primary = ref
      if (!small && m.role === "small") small = ref
    }
    provider[pid] = {
      name: "openai-compatible",
      npm: "@ai-sdk/openai-compatible",
      models: defs,
      options: {
        baseURL: first.base_url,
        headers: { Authorization: `Bearer ${first.api_key}` },
      },
    }
  }
  if (!primary && models.length) primary = `platform_0/${models[0]!.model_id}`
  if (!small) small = primary

  // --- MCP ---
  const mcp: Record<string, unknown> = {}
  for (const m of mcps) {
    const c = m.config as Record<string, unknown>
    if (c.type === "stdio") {
      const cmd = Array.isArray(c.command) ? c.command as string[] : String(c.command).split(/\s+/)
      const env = (c.env && typeof c.env === "object") ? c.env as Record<string, string> : undefined
      mcp[m.name] = { type: "local" as const, command: cmd, ...(env ? { environment: env } : {}) }
    } else {
      const hdrs = (c.headers && typeof c.headers === "object") ? c.headers as Record<string, string> : undefined
      mcp[m.name] = { type: "remote" as const, url: String(c.url), ...(hdrs ? { headers: hdrs } : {}) }
    }
  }

  return JSON.stringify({
    provider,
    model: primary,
    small_model: small,
    enabled_providers: pids,
    disabled_providers: [] as string[],
    username: user?.name,
    share: "disabled",
    autoupdate: false,
    mcp,
  })
}
