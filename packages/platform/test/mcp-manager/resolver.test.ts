import { describe, test, expect } from "bun:test"
import { filterByVisibility } from "@/mcp-manager/resolver"

describe("mcp resolver", () => {
  const mcps = [
    { id: "1", name: "git", visibility: "PUBLIC", owner_id: "u1", enabled: true },
    { id: "2", name: "erp", visibility: "SHARED", owner_id: "u2", enabled: true },
    { id: "3", name: "my-tool", visibility: "PRIVATE", owner_id: "u1", enabled: true },
    { id: "4", name: "disabled", visibility: "PUBLIC", owner_id: "u1", enabled: false },
  ] as any[]

  const auths = [
    { mcp_id: "2", grantee_type: "user", grantee_id: "u1" },
    { mcp_id: "2", grantee_type: "department", grantee_id: "d1" },
  ] as any[]

  test("returns all PUBLIC enabled MCPs", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u3", roles: [], dept_ids: [] })
    const names = result.map((m) => m.name)
    expect(names).toContain("git")
    expect(names).not.toContain("disabled")
  })

  test("returns own PRIVATE MCPs", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u1", roles: [], dept_ids: [] })
    expect(result.map((m) => m.name)).toContain("my-tool")
  })

  test("excludes other user PRIVATE MCPs", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u3", roles: [], dept_ids: [] })
    expect(result.map((m) => m.name)).not.toContain("my-tool")
  })

  test("returns SHARED MCPs if authorized by user", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u1", roles: [], dept_ids: [] })
    expect(result.map((m) => m.name)).toContain("erp")
  })

  test("returns SHARED MCPs if authorized by department", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u99", roles: [], dept_ids: ["d1"] })
    expect(result.map((m) => m.name)).toContain("erp")
  })

  test("excludes SHARED MCPs if not authorized", () => {
    const result = filterByVisibility(mcps, auths, { internal_id: "u99", roles: [], dept_ids: ["d99"] })
    expect(result.map((m) => m.name)).not.toContain("erp")
  })
})
