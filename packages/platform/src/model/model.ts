import { eq } from "drizzle-orm"
import { llm_model } from "./model.sql"
import type { Database } from "@/db"

function mask(key: string) {
  if (key.length <= 8) return "***"
  return key.slice(0, 4) + "***" + key.slice(-4)
}

export async function list(db: Database) {
  const rows = await db.select().from(llm_model).orderBy(llm_model.sort_order)
  return rows.map((r) => ({ ...r, api_key: mask(r.api_key) }))
}

export function enabled(db: Database) {
  return db
    .select({
      id: llm_model.id,
      name: llm_model.name,
      model_id: llm_model.model_id,
      provider: llm_model.provider,
      base_url: llm_model.base_url,
      enabled: llm_model.enabled,
      sort_order: llm_model.sort_order,
    })
    .from(llm_model)
    .where(eq(llm_model.enabled, true))
    .orderBy(llm_model.sort_order)
}

export function byId(db: Database, id: string) {
  return db
    .select()
    .from(llm_model)
    .where(eq(llm_model.id, id))
    .then((r) => r[0])
}

export async function create(
  db: Database,
  input: {
    name: string
    model_id: string
    provider?: string
    base_url: string
    api_key: string
    enabled?: boolean
    sort_order?: number
  },
) {
  const [row] = await db.insert(llm_model).values(input).returning()
  return row
}

export async function update(
  db: Database,
  id: string,
  input: {
    name?: string
    model_id?: string
    provider?: string
    base_url?: string
    api_key?: string
    enabled?: boolean
    sort_order?: number
  },
) {
  const [row] = await db
    .update(llm_model)
    .set({ ...input, updated_at: new Date() })
    .where(eq(llm_model.id, id))
    .returning()
  return row
}

export async function remove(db: Database, id: string) {
  await db.delete(llm_model).where(eq(llm_model.id, id))
}
