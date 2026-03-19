import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { env } from "@/env"
import * as feishu from "@/auth/feishu"
import * as identity from "@/auth/identity"
import * as jwt from "@/auth/jwt"
import * as rbac from "@/rbac/role"
import { database } from "@/db"

const FEISHU_AUTH_BASE = "https://accounts.feishu.cn/open-apis/authen/v1/authorize"

export const auth = new Hono()
  .get("/feishu/url", (c) => {
    const cfg = env()
    const origin = c.req.header("Origin") ?? c.req.header("Referer") ?? ""
    const base = cfg.DASHBOARD_URL ?? (origin ? new URL(origin).origin : "http://localhost:3200")
    const redirect = `${base}/login`
    const url = `${FEISHU_AUTH_BASE}?client_id=${cfg.FEISHU_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code`
    return c.json({ url })
  })
  .post(
    "/feishu/callback",
    zValidator("json", z.object({ code: z.string() })),
    async (c) => {
      const { code } = c.req.valid("json")
      const cfg = env()
      const db = database()

      try {
        const origin = c.req.header("Origin") ?? c.req.header("Referer") ?? ""
        const base = cfg.DASHBOARD_URL ?? (origin ? new URL(origin).origin : "http://localhost:3200")
        const redirect = `${base}/login`

        console.log("[auth] exchanging code for token, redirect_uri:", redirect)
        const { access_token } = await feishu.exchangeCode(code, redirect)
        console.log("[auth] got access_token, fetching user info...")
        const info = await feishu.userInfo(access_token)
        console.log("[auth] user info:", info.name, info.user_id)

        const user = await identity.upsertFromFeishu(db, {
          feishu_user_id: info.user_id,
          feishu_union_id: info.union_id,
          name: info.name,
          email: info.email,
          avatar_url: info.avatar_url,
          department_ids: info.department_ids,
          job_level: info.job_level_id,
        })

        await rbac.seed(db)
        await rbac.bootstrap(db, user.internal_id)
        const names = await rbac.userRoleNames(db, user.internal_id)
        const roles = ["authenticated", ...names]
        console.log("[auth] user roles:", roles)

        const token = await jwt.sign(
          {
            sub: user.internal_id,
            roles,
            depts: user.department_ids as string[],
            level: user.job_level ?? "",
          },
          cfg.JWT_SECRET,
          cfg.JWT_EXPIRY,
        )

        return c.json({
          token,
          user: {
            id: user.internal_id,
            name: user.name,
            email: user.email,
            avatar: user.avatar_url,
          },
        })
      } catch (err: any) {
        console.error("[auth] callback failed:", err)
        return c.json({ error: err?.message ?? "登录失败" }, 500)
      }
    },
  )
  .post("/refresh", async (c) => {
    const header = c.req.header("Authorization")
    if (!header?.startsWith("Bearer ")) return c.json({ error: "missing token" }, 401)
    const cfg = env()
    try {
      const token = await jwt.refresh(header.slice(7), cfg.JWT_SECRET, cfg.JWT_EXPIRY)
      return c.json({ token })
    } catch {
      return c.json({ error: "invalid token" }, 401)
    }
  })
  .get("/me", async (c) => {
    const header = c.req.header("Authorization")
    if (!header?.startsWith("Bearer ")) return c.json({ error: "missing token" }, 401)
    try {
      const payload = await jwt.verify(header.slice(7), env().JWT_SECRET)
      const db = database()
      const user = await identity.byInternalId(db, payload.sub)
      if (!user) return c.json({ error: "user not found" }, 404)
      return c.json({
        id: user.internal_id,
        name: user.name,
        email: user.email,
        avatar: user.avatar_url,
        departments: user.department_ids,
        level: user.job_level,
        roles: payload.roles,
      })
    } catch {
      return c.json({ error: "invalid token" }, 401)
    }
  })
