import { describe, test, expect } from "bun:test"
import { periodKey } from "@/billing/quota"

describe("quota", () => {
  test("periodKey daily format", () => {
    const key = periodKey("daily", new Date("2026-03-18T10:00:00Z"))
    expect(key).toBe("2026-03-18")
  })

  test("periodKey monthly format", () => {
    const key = periodKey("monthly", new Date("2026-03-18T10:00:00Z"))
    expect(key).toBe("2026-03")
  })
})
