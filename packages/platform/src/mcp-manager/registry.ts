import { eq, desc } from "drizzle-orm"
import { mcp_registry, mcp_group } from "./registry.sql"
import type { Database } from "@/db"

export type McpEntry = typeof mcp_registry.$inferSelect
export type Visibility = "PUBLIC" | "PRIVATE" | "SHARED"

export function create(db: Database, input: typeof mcp_registry.$inferInsert) {
  return db.insert(mcp_registry).values(input).returning().then((r) => r[0])
}

export function update(db: Database, id: string, input: Partial<typeof mcp_registry.$inferInsert>) {
  return db
    .update(mcp_registry)
    .set({ ...input, updated_at: new Date() })
    .where(eq(mcp_registry.id, id))
    .returning()
    .then((r) => r[0])
}

export function remove(db: Database, id: string) {
  return db.delete(mcp_registry).where(eq(mcp_registry.id, id))
}

export function byId(db: Database, id: string) {
  return db.select().from(mcp_registry).where(eq(mcp_registry.id, id)).then((r) => r[0])
}

export function byName(db: Database, name: string) {
  return db.select().from(mcp_registry).where(eq(mcp_registry.name, name)).then((r) => r[0])
}

export function listAll(db: Database, opts?: { visibility?: Visibility; enabled?: boolean }) {
  let query = db.select().from(mcp_registry)
  if (opts?.visibility) query = query.where(eq(mcp_registry.visibility, opts.visibility)) as any
  if (opts?.enabled !== undefined) query = query.where(eq(mcp_registry.enabled, opts.enabled)) as any
  return query.orderBy(desc(mcp_registry.updated_at))
}

export function updateHealth(db: Database, id: string, status: string) {
  return db
    .update(mcp_registry)
    .set({ health_status: status, last_health_at: new Date() })
    .where(eq(mcp_registry.id, id))
}

export function groups(db: Database) {
  return db.select().from(mcp_group)
}

export function createGroup(db: Database, input: typeof mcp_group.$inferInsert) {
  return db.insert(mcp_group).values(input).returning().then((r) => r[0])
}
