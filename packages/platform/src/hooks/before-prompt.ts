import { HTTPException } from "hono/http-exception"
import { database } from "@/db"
import * as identity from "@/auth/identity"
import * as quota from "@/billing/quota"
import { slidingWindow, configForRole } from "@/billing/rate-limit"

export async function beforePrompt(input: {
  sessionID: string
  userId?: string
  system: string[]
}) {
  if (!input.userId) return input
  const db = database()
  const user = await identity.byInternalId(db, input.userId)
  if (!user) return input

  const deptIds = (user.department_ids ?? []) as string[]
  const quotaResult = await quota.checkQuota(db, { userId: input.userId, deptIds })
  if (!quotaResult.allowed) {
    throw new HTTPException(429, { message: quotaResult.reason })
  }

  const uid = input.userId
  const roles = await import("@/rbac/role").then((m) =>
    m.userRoleNames(db, uid, deptIds),
  )
  const cfg = configForRole(roles)
  const rlKey = slidingWindow.key("user", input.userId, "rpm")
  const rl = await slidingWindow.check({ key: rlKey, limit: cfg.rpm, window: 60 })
  if (!rl.allowed) {
    throw new HTTPException(429, { message: "请求过于频繁，请稍后再试" })
  }

  return input
}
