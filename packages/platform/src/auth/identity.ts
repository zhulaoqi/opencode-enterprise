import { and, eq, ilike, or } from "drizzle-orm"
import { identity_mapping } from "./identity.sql"
import type { Database } from "@/db"

export type Identity = typeof identity_mapping.$inferSelect
export type NewIdentity = typeof identity_mapping.$inferInsert

export function byFeishuId(db: Database, feishu_user_id: string) {
  return db.select().from(identity_mapping).where(eq(identity_mapping.feishu_user_id, feishu_user_id)).then((r) => r[0])
}

export function byUnionId(db: Database, union_id: string) {
  return db.select().from(identity_mapping).where(eq(identity_mapping.feishu_union_id, union_id)).then((r) => r[0])
}

export function byInternalId(db: Database, id: string) {
  return db.select().from(identity_mapping).where(eq(identity_mapping.internal_id, id)).then((r) => r[0])
}

export async function upsertFromFeishu(
  db: Database,
  input: {
    feishu_user_id: string
    feishu_union_id: string
    name: string
    email: string
    avatar_url: string
    department_ids: string[]
    job_level: string
  },
): Promise<Identity> {
  const existing = await byFeishuId(db, input.feishu_user_id)
  if (existing) {
    const [updated] = await db
      .update(identity_mapping)
      .set({
        name: input.name,
        email: input.email,
        avatar_url: input.avatar_url,
        department_ids: input.department_ids,
        job_level: input.job_level,
        feishu_union_id: input.feishu_union_id,
        last_sync_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(identity_mapping.feishu_user_id, input.feishu_user_id))
      .returning()
    if (!updated) throw new Error("identity update failed")
    return updated
  }
  const [created] = await db
    .insert(identity_mapping)
    .values({
      feishu_user_id: input.feishu_user_id,
      feishu_union_id: input.feishu_union_id,
      name: input.name,
      email: input.email,
      avatar_url: input.avatar_url,
      department_ids: input.department_ids,
      job_level: input.job_level,
      last_sync_at: new Date(),
    })
    .returning()
  if (!created) throw new Error("identity insert failed")
  return created
}

export function list(
  db: Database,
  opts?: { status?: string; search?: string; limit?: number; offset?: number },
) {
  let query = db.select().from(identity_mapping)
  const conds = []
  if (opts?.status) conds.push(eq(identity_mapping.status, opts.status))
  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`
    conds.push(or(ilike(identity_mapping.name, s), ilike(identity_mapping.email, s), ilike(identity_mapping.employee_id, s))!)
  }
  if (conds.length > 0) query = query.where(and(...conds)) as any
  if (opts?.limit) query = query.limit(opts.limit) as any
  if (opts?.offset) query = query.offset(opts.offset) as any
  return query
}
