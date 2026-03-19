import { describe, test, expect } from "bun:test"
import { evaluate } from "@/rbac/permission"
import type { RolePermission } from "@/rbac/role.sql"

describe("permission evaluation", () => {
  const perms: RolePermission[] = [
    { type: "feature", pattern: "chat", action: "allow" },
    { type: "feature", pattern: "admin_dashboard", action: "deny" },
    { type: "feature", pattern: "*", action: "allow" },
  ]

  test("allows matching feature pattern", () => {
    expect(evaluate(perms, "chat")).toBe("allow")
  })

  test("denies matching feature pattern", () => {
    expect(evaluate(perms, "admin_dashboard")).toBe("deny")
  })

  test("allows wildcard match", () => {
    expect(evaluate(perms, "settings")).toBe("allow")
  })

  test("deny takes precedence over wildcard allow", () => {
    expect(evaluate(perms, "admin_dashboard")).toBe("deny")
  })

  test("denies when no permissions match", () => {
    const empty: RolePermission[] = []
    expect(evaluate(empty, "anything")).toBe("deny")
  })

  test("merges permissions with deny taking precedence", () => {
    const mixed: RolePermission[] = [
      { type: "feature", pattern: "approval", action: "allow" },
      { type: "feature", pattern: "approval", action: "deny" },
    ]
    expect(evaluate(mixed, "approval")).toBe("deny")
  })
})
