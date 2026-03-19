import { eq, and, desc } from "drizzle-orm"
import type { Database } from "@/db"
import { mcp_member, mcp_application } from "./member.sql"

export function members(db: Database, mcpId: string) {
  return db.select().from(mcp_member).where(eq(mcp_member.mcp_id, mcpId))
}

export function add(db: Database, mcpId: string, userIds: string[], role: string, grantedBy: string) {
  return db
    .insert(mcp_member)
    .values(userIds.map((uid) => ({ mcp_id: mcpId, user_id: uid, role, granted_by: grantedBy })))
    .onConflictDoNothing()
    .returning()
}

export function remove(db: Database, mcpId: string, userId: string) {
  return db.delete(mcp_member).where(and(eq(mcp_member.mcp_id, mcpId), eq(mcp_member.user_id, userId)))
}

export function updateRole(db: Database, mcpId: string, userId: string, role: string) {
  return db
    .update(mcp_member)
    .set({ role })
    .where(and(eq(mcp_member.mcp_id, mcpId), eq(mcp_member.user_id, userId)))
    .returning()
    .then((r) => r[0])
}

export async function isAdmin(db: Database, mcpId: string, userId: string): Promise<boolean> {
  const row = await db
    .select()
    .from(mcp_member)
    .where(and(eq(mcp_member.mcp_id, mcpId), eq(mcp_member.user_id, userId)))
    .then((r) => r[0])
  if (!row) return false
  return row.role === "owner" || row.role === "admin"
}

export async function hasAccess(db: Database, mcpId: string, userId: string, visibility: string): Promise<boolean> {
  if (visibility === "PUBLIC") return true
  const row = await db
    .select()
    .from(mcp_member)
    .where(and(eq(mcp_member.mcp_id, mcpId), eq(mcp_member.user_id, userId)))
    .then((r) => r[0])
  if (visibility === "PRIVATE") return row?.role === "owner"
  return !!row
}

export function apply(db: Database, mcpId: string, userId: string, reason?: string) {
  return db
    .insert(mcp_application)
    .values({ mcp_id: mcpId, user_id: userId, status: "pending", reason })
    .returning()
    .then((r) => r[0])
}

export function applications(db: Database, mcpId: string) {
  return db
    .select()
    .from(mcp_application)
    .where(eq(mcp_application.mcp_id, mcpId))
    .orderBy(desc(mcp_application.created_at))
}

export async function review(db: Database, aid: string, approved: boolean, reviewedBy: string) {
  const status = approved ? "approved" : "rejected"
  const row = await db
    .update(mcp_application)
    .set({ status, reviewed_by: reviewedBy, reviewed_at: new Date() })
    .where(eq(mcp_application.id, aid))
    .returning()
    .then((r) => r[0])
  if (approved && row) {
    await db
      .insert(mcp_member)
      .values({ mcp_id: row.mcp_id, user_id: row.user_id, role: "user", granted_by: reviewedBy })
      .onConflictDoNothing()
  }
  return row
}
