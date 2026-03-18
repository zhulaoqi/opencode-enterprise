import type { Tool } from "ai"
import { database } from "@/db"
import * as resolver from "@/mcp-manager/resolver"
import { filterTools } from "@/rbac/permission"
import { userPermissions, userRoleNames } from "@/rbac/role"
import * as identity from "@/auth/identity"

export async function afterToolResolve(input: {
  sessionID: string
  userId?: string
  tools: Record<string, Tool>
}) {
  if (!input.userId) return input
  const db = database()
  const user = await identity.byInternalId(db, input.userId)
  if (!user) return input

  const deptIds = (user.department_ids ?? []) as string[]
  const [perms, roles] = await Promise.all([
    userPermissions(db, input.userId, deptIds),
    userRoleNames(db, input.userId, deptIds),
  ])
  const resolved = await resolver.resolve(db, {
    internal_id: input.userId,
    roles,
    dept_ids: deptIds,
  })
  const mcpNames = new Set(resolved.map((m) => m.name))

  const filtered: Record<string, Tool> = {}
  for (const [key, tool] of Object.entries(input.tools)) {
    const mcpName = key.split("_")[0]
    if (mcpNames.has(mcpName)) {
      const allowed = filterTools([{ name: key }], perms)
      if (allowed.includes(key)) filtered[key] = tool
    } else {
      const allowed = filterTools([{ name: key }], perms)
      if (allowed.includes(key)) filtered[key] = tool
    }
  }
  return { ...input, tools: filtered }
}
