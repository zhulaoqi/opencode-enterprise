import type { Tool } from "ai"

// Filters resolved tools based on user RBAC permissions
export async function afterToolResolve(input: {
  sessionID: string
  userId?: string
  tools: Record<string, Tool>
}) {
  // TODO: wire to RBAC permission.evaluate to filter tools
  return input
}
