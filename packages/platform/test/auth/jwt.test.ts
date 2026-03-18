import { describe, test, expect } from "bun:test"
import { sign, verify, refresh } from "@/auth/jwt"

describe("jwt", () => {
  const secret = "test-secret-that-is-at-least-32-chars-long!!"
  const payload = {
    sub: "user-123",
    roles: ["developer"],
    depts: ["dept-001"],
    level: "P6",
  }

  test("sign and verify roundtrip", async () => {
    const token = await sign(payload, secret, "1h")
    const decoded = await verify(token, secret)
    expect(decoded.sub).toBe("user-123")
    expect(decoded.roles).toEqual(["developer"])
  })

  test("expired token throws", async () => {
    const token = await sign(payload, secret, "0s")
    await Bun.sleep(100)
    expect(verify(token, secret)).rejects.toThrow()
  })

  test("refresh returns new token", async () => {
    const token = await sign(payload, secret, "2h")
    await Bun.sleep(1100)
    const next = await refresh(token, secret, "2h")
    expect(next).not.toBe(token)
    const decoded = await verify(next, secret)
    expect(decoded.sub).toBe("user-123")
  })
})
