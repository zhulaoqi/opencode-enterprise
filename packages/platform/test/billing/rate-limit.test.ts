import { describe, test, expect } from "bun:test"
import { slidingWindow } from "@/billing/rate-limit"

describe("rate-limit", () => {
  test("slidingWindow key format", () => {
    const key = slidingWindow.key("user", "u1", "rpm")
    expect(key).toBe("ratelimit:user:u1:rpm")
  })
})
