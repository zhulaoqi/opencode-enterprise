import { HTTPException } from "hono/http-exception"
import { database } from "@/db"
import * as identity from "@/auth/identity"
import * as quota from "@/billing/quota"
import { slidingWindow, configForRole } from "@/billing/rate-limit"
import { userId as processUserId } from "./context"

export async function beforePrompt(input: {
  sessionID: string
  userId?: string
  system: string[]
}) {
  const uid = input.userId ?? processUserId()
  if (!uid) return input
  const db = database()
  const user = await identity.byInternalId(db, uid)
  if (!user) return input

  const quotaResult = await quota.checkQuota(db, { userId: uid })
  if (!quotaResult.allowed) {
    throw new HTTPException(429, { message: quotaResult.reason })
  }

  const roles = await import("@/rbac/role").then((m) =>
    m.userRoleNames(db, uid),
  )
  const cfg = configForRole(roles)
  const rlKey = slidingWindow.key("user", uid, "rpm")
  const rl = await slidingWindow.check({ key: rlKey, limit: cfg.rpm, window: 60 })
  if (!rl.allowed) {
    throw new HTTPException(429, { message: "请求过于频繁，请稍后再试" })
  }

  return input
}
