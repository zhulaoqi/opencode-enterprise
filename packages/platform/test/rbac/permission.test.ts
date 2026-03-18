import { describe, test, expect } from "bun:test"
import { evaluate } from "@/rbac/permission"
import type { RolePermission } from "@/rbac/role.sql"

describe("permission evaluation", () => {
  const perms: RolePermission[] = [
    { type: "mcp_tool", pattern: "git_*", action: "allow" },
    { type: "mcp_tool", pattern: "erp_*", action: "deny" },
    { type: "mcp_server", pattern: "ci_cd", action: "allow" },
    { type: "feature", pattern: "admin_dashboard", action: "deny" },
  ]

  test("allows matching tool pattern", () => {
    expect(evaluate(perms, "mcp_tool", "git_push")).toBe("allow")
  })

  test("denies matching tool pattern", () => {
    expect(evaluate(perms, "mcp_tool", "erp_query")).toBe("deny")
  })

  test("denies unmatched tool (default deny)", () => {
    expect(evaluate(perms, "mcp_tool", "slack_send")).toBe("deny")
  })

  test("allows matching server", () => {
    expect(evaluate(perms, "mcp_server", "ci_cd")).toBe("allow")
  })

  test("denies matching feature", () => {
    expect(evaluate(perms, "feature", "admin_dashboard")).toBe("deny")
  })

  test("merges permissions with deny taking precedence", () => {
    const mixed: RolePermission[] = [
      { type: "mcp_tool", pattern: "erp_*", action: "allow" },
      { type: "mcp_tool", pattern: "erp_delete", action: "deny" },
    ]
    expect(evaluate(mixed, "mcp_tool", "erp_query")).toBe("allow")
    expect(evaluate(mixed, "mcp_tool", "erp_delete")).toBe("deny")
  })
})
