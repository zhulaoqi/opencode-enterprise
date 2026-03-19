import { eq } from "drizzle-orm"
import { mcp_registry } from "./registry.sql"
import { mcp_member } from "./member.sql"
import type { Database } from "@/db"

type UserCtx = {
  internal_id: string
}

export async function resolve(db: Database, user: UserCtx) {
  const mcps = await db.select().from(mcp_registry).where(eq(mcp_registry.enabled, true))
  const rows = await db
    .select()
    .from(mcp_member)
    .where(eq(mcp_member.user_id, user.internal_id))
  const ids = new Set(rows.map((r) => r.mcp_id))
  return mcps.filter((m) => {
    if (m.visibility === "PUBLIC") return true
    if (m.visibility === "PRIVATE") {
      const row = rows.find((r) => r.mcp_id === m.id)
      return row?.role === "owner"
    }
    return ids.has(m.id)
  })
}

export async function market(db: Database, user: UserCtx) {
  const mcps = await db.select().from(mcp_registry)
  const rows = await db
    .select()
    .from(mcp_member)
    .where(eq(mcp_member.user_id, user.internal_id))
  const ids = new Set(rows.map((r) => r.mcp_id))
  return mcps.map((m) => {
    if (m.visibility === "PUBLIC") return { ...m, accessible: true, authorized: true }
    if (m.visibility === "PRIVATE") {
      const owner = rows.find((r) => r.mcp_id === m.id)?.role === "owner"
      return { ...m, accessible: owner, authorized: owner }
    }
    return { ...m, accessible: true, authorized: ids.has(m.id) }
  })
}
