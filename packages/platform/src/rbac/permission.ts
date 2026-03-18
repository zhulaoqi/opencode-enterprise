import type { RolePermission } from "./role.sql"

function matches(pattern: string, value: string): boolean {
  if (pattern === value) return true
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1))
  return false
}

export function evaluate(
  perms: RolePermission[],
  type: RolePermission["type"],
  target: string,
): "allow" | "deny" {
  const relevant = perms.filter((p) => p.type === type && matches(p.pattern, target))
  if (relevant.length === 0) return "deny"
  if (relevant.some((p) => p.action === "deny" && matches(p.pattern, target))) return "deny"
  if (relevant.some((p) => p.action === "allow")) return "allow"
  return "deny"
}

export function merge(...sets: RolePermission[][]): RolePermission[] {
  return sets.flat()
}

export function filterTools(tools: { name: string }[], perms: RolePermission[]): string[] {
  return tools.filter((t) => evaluate(perms, "mcp_tool", t.name) === "allow").map((t) => t.name)
}
