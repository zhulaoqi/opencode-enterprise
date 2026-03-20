import { and, eq, inArray } from "drizzle-orm"
import { role, user_role, type RolePermission } from "./role.sql"
import type { Database } from "@/db"
import { merge } from "./permission"

export async function seed(db: Database) {
  const defaults: { name: string; display_name: string; description: string; permissions: RolePermission[] }[] = [
    {
      name: "developer",
      display_name: "开发者",
      description: "使用 AI 对话、执行代码任务，适合所有研发人员",
      permissions: [{ type: "feature", pattern: "chat", action: "allow" }],
    },
    {
      name: "finance",
      display_name: "财务",
      description: "在开发者基础上可审批资源申请，适合财务/审批人员",
      permissions: [
        { type: "feature", pattern: "chat", action: "allow" },
        { type: "feature", pattern: "approval", action: "allow" },
      ],
    },
    {
      name: "manager",
      display_name: "管理者",
      description: "可查看仪表盘、管理配额、查看节点状态（只读），适合团队负责人",
      permissions: [
        { type: "feature", pattern: "dashboard", action: "allow" },
        { type: "feature", pattern: "quota_manage", action: "allow" },
        { type: "feature", pattern: "chat", action: "allow" },
      ],
    },
    {
      name: "admin",
      display_name: "管理员",
      description: "全部权限，包括用户管理、模型配置、节点操控，适合系统运维人员",
      permissions: [{ type: "feature", pattern: "*", action: "allow" }],
    },
  ]
  for (const r of defaults) {
    await db
      .insert(role)
      .values({ ...r, is_system: true })
      .onConflictDoUpdate({
        target: role.name,
        set: { display_name: r.display_name, description: r.description, permissions: r.permissions },
      })
  }
}

export async function userRoleNames(db: Database, userId: string): Promise<string[]> {
  const rows = await db.select({ role_id: user_role.role_id }).from(user_role).where(eq(user_role.user_id, userId))
  const ids = rows.map((r) => r.role_id)
  if (ids.length === 0) return []
  const roles = await db.select({ name: role.name }).from(role).where(inArray(role.id, ids))
  return roles.map((r) => r.name)
}

export async function bootstrap(db: Database, userId: string) {
  const admin = await db.select().from(role).where(eq(role.name, "admin")).then((r) => r[0])
  if (!admin) return
  const existing = await db.select().from(user_role).where(eq(user_role.role_id, admin.id))
  if (existing.length > 0) return
  console.log("[rbac] no admin users found, bootstrapping first user as admin:", userId)
  await db.insert(user_role).values({ user_id: userId, role_id: admin.id }).onConflictDoNothing()
}

export function assignRole(db: Database, userId: string, roleId: string) {
  return db.insert(user_role).values({ user_id: userId, role_id: roleId }).onConflictDoNothing()
}

export function removeRole(db: Database, userId: string, roleId: string) {
  return db.delete(user_role).where(and(eq(user_role.user_id, userId), eq(user_role.role_id, roleId)))
}

export async function userRoles(db: Database, userId: string) {
  const rows = await db
    .select({ role_id: user_role.role_id, role_name: role.name })
    .from(user_role)
    .innerJoin(role, eq(user_role.role_id, role.id))
    .where(eq(user_role.user_id, userId))
  return rows
}

export function all(db: Database) {
  return db.select().from(role)
}

export async function autoAssign(db: Database, userId: string) {
  const dev = await db.select().from(role).where(eq(role.name, "developer")).then((r) => r[0])
  if (!dev) return
  await db.insert(user_role).values({ user_id: userId, role_id: dev.id }).onConflictDoNothing()
}
