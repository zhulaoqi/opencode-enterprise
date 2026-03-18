import { eq, inArray } from "drizzle-orm"
import { role, user_role, department_role, type RolePermission } from "./role.sql"
import type { Database } from "@/db"
import { merge } from "./permission"

export async function seed(db: Database) {
  const defaults: { name: string; display_name: string; permissions: RolePermission[] }[] = [
    {
      name: "developer",
      display_name: "Developer",
      permissions: [
        { type: "mcp_tool", pattern: "git_*", action: "allow" },
        { type: "mcp_tool", pattern: "jira_*", action: "allow" },
        { type: "mcp_tool", pattern: "ci_cd_*", action: "allow" },
        { type: "mcp_server", pattern: "git", action: "allow" },
        { type: "mcp_server", pattern: "jira", action: "allow" },
        { type: "feature", pattern: "chat", action: "allow" },
      ],
    },
    {
      name: "finance",
      display_name: "Finance",
      permissions: [
        { type: "mcp_tool", pattern: "erp_*", action: "allow" },
        { type: "mcp_tool", pattern: "expense_*", action: "allow" },
        { type: "mcp_server", pattern: "erp", action: "allow" },
        { type: "feature", pattern: "chat", action: "allow" },
        { type: "feature", pattern: "approval", action: "allow" },
      ],
    },
    {
      name: "manager",
      display_name: "Manager",
      permissions: [
        { type: "feature", pattern: "dashboard", action: "allow" },
        { type: "feature", pattern: "quota_manage", action: "allow" },
        { type: "feature", pattern: "chat", action: "allow" },
      ],
    },
    {
      name: "admin",
      display_name: "Administrator",
      permissions: [
        { type: "mcp_tool", pattern: "*", action: "allow" },
        { type: "mcp_server", pattern: "*", action: "allow" },
        { type: "feature", pattern: "*", action: "allow" },
      ],
    },
  ]
  for (const r of defaults) {
    await db.insert(role).values({ ...r, is_system: true }).onConflictDoNothing({ target: role.name })
  }
}

export async function userRoleNames(db: Database, userId: string, deptIds: string[]): Promise<string[]> {
  const userRoles = await db.select({ role_id: user_role.role_id }).from(user_role).where(eq(user_role.user_id, userId))

  const deptRoles =
    deptIds.length > 0
      ? await db
          .select({ role_id: department_role.role_id })
          .from(department_role)
          .where(inArray(department_role.department_id, deptIds))
      : []

  const ids = [...new Set([...userRoles, ...deptRoles].map((r) => r.role_id))]
  if (ids.length === 0) return []

  const roles = await db.select({ name: role.name }).from(role).where(inArray(role.id, ids))
  return roles.map((r) => r.name)
}

export async function userPermissions(db: Database, userId: string, deptIds: string[]): Promise<RolePermission[]> {
  const userRoles = await db.select({ role_id: user_role.role_id }).from(user_role).where(eq(user_role.user_id, userId))

  const deptRoles =
    deptIds.length > 0
      ? await db
          .select({ role_id: department_role.role_id })
          .from(department_role)
          .where(inArray(department_role.department_id, deptIds))
      : []

  const ids = [...new Set([...userRoles, ...deptRoles].map((r) => r.role_id))]
  if (ids.length === 0) return []

  const roles = await db.select().from(role).where(inArray(role.id, ids))
  return merge(...roles.map((r) => r.permissions))
}

export function assignRole(db: Database, userId: string, roleId: string) {
  return db.insert(user_role).values({ user_id: userId, role_id: roleId }).onConflictDoNothing()
}

export function all(db: Database) {
  return db.select().from(role)
}
