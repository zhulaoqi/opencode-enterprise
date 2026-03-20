import { database } from "@/db"
import * as resolver from "@/mcp-manager/resolver"
import { llm_model } from "@/model/model.sql"
import { eq } from "drizzle-orm"
import { env } from "@/env"

export async function serialize(uid: string) {
  const db = database()
  const mcps = await resolver.resolve(db, { internal_id: uid })
  const models = await db.select().from(llm_model).where(eq(llm_model.enabled, true)).orderBy(llm_model.sort_order)
  const cfg = env()

  const mcp: Record<string, unknown> = {}
  for (const m of mcps) {
    const c = m.config as Record<string, unknown>
    if (c.type === "stdio") {
      mcp[m.name] = { type: "local", command: c.command, environment: c.env }
    } else {
      mcp[m.name] = { type: "remote", url: c.url, headers: c.headers }
    }
  }

  const primary = models[0]
  const key = primary?.api_key ?? cfg.OPENAI_API_KEY ?? ""
  const base = primary?.base_url ?? cfg.OPENAI_BASE_URL ?? ""
  const mid = primary?.model_id ?? cfg.LLM_MODEL ?? ""

  return JSON.stringify({
    provider: {
      custom: {
        name: "custom",
        options: { apiKey: key, baseURL: base },
      },
    },
    model: mid ? `custom/${mid}` : undefined,
    mcp,
  })
}
