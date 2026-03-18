import { eq } from "drizzle-orm"
import { mcp_registry, mcp_authorization } from "./registry.sql"
import type { Database } from "@/db"

type UserCtx = {
  internal_id: string
  roles: string[]
  dept_ids: string[]
}

export function filterByVisibility(mcps: any[], auths: any[], user: UserCtx): any[] {
  return mcps.filter((mcp) => {
    if (!mcp.enabled) return false
    if (mcp.visibility === "PUBLIC") return true
    if (mcp.visibility === "PRIVATE") return mcp.owner_id === user.internal_id
    if (mcp.visibility === "SHARED") {
      return auths.some(
        (a) =>
          a.mcp_id === mcp.id &&
          ((a.grantee_type === "user" && a.grantee_id === user.internal_id) ||
            (a.grantee_type === "role" && user.roles.includes(a.grantee_id)) ||
            (a.grantee_type === "department" && user.dept_ids.includes(a.grantee_id))),
      )
    }
    return false
  })
}

export async function resolve(db: Database, user: UserCtx) {
  const allMcps = await db.select().from(mcp_registry).where(eq(mcp_registry.enabled, true))
  const allAuths = await db.select().from(mcp_authorization)
  return filterByVisibility(allMcps, allAuths, user)
}

export async function market(db: Database, user: UserCtx) {
  const allMcps = await db.select().from(mcp_registry)
  const allAuths = await db.select().from(mcp_authorization)
  return allMcps.map((mcp) => {
    const accessible = filterByVisibility([mcp], allAuths, user).length > 0
    const authorized = mcp.visibility !== "SHARED" || accessible
    return { ...mcp, accessible, authorized }
  })
}
