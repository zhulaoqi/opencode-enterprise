import { describe, test, expect } from "bun:test"
import { verifySignature } from "@/im-adapter/feishu/webhook"

describe("feishu webhook", () => {
  test("accepts valid verification token", () => {
    const body = { token: "test-token", type: "url_verification", challenge: "abc" }
    expect(verifySignature(body, "test-token")).toBe(true)
  })

  test("rejects invalid token", () => {
    const body = { token: "wrong-token", type: "url_verification", challenge: "abc" }
    expect(verifySignature(body, "test-token")).toBe(false)
  })
})
