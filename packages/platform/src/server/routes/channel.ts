import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as channel from "@/channel/channel"
import * as feishuWs from "@/im-adapter/feishu/ws-receiver"
import { clearToken } from "@/im-adapter/feishu/client"

const ch = new Hono()
  .use("/*", auth)
  .use("/*", requireRole("admin"))

  .get("/", async (c) => {
    const db = database()
    const rows = await channel.list(db)
    return c.json({ channels: rows.map(channel.sanitize) })
  })

  .put(
    "/:type",
    zValidator(
      "json",
      z.object({
        enabled: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
    async (c) => {
      const db = database()
      const type = c.req.param("type")
      if (!["feishu", "dingtalk", "wecom"].includes(type)) {
        return c.json({ error: "Invalid channel type" }, 400)
      }
      const body = c.req.valid("json")
      const row = await channel.upsert(db, type, body)
      clearCache(type)
      if (type === "feishu") {
        clearToken()
        feishuWs.restart().catch(() => {})
      }
      return c.json({ channel: row ? channel.sanitize(row) : null })
    },
  )

  .delete("/:type", async (c) => {
    const db = database()
    const type = c.req.param("type")
    await channel.remove(db, type)
    clearCache(type)
    if (type === "feishu") {
      clearToken()
      feishuWs.stop()
    }
    return c.json({ ok: true })
  })

  .post("/:type/test", async (c) => {
    const db = database()
    const type = c.req.param("type")
    const row = await channel.byType(db, type)
    if (!row) return c.json({ ok: false, error: "渠道未配置" }, 400)

    const cfg = (row.config ?? {}) as Record<string, string>

    if (type === "feishu") {
      try {
        const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: cfg.app_id, app_secret: cfg.app_secret }),
        })
        const data = (await res.json()) as { code?: number; tenant_access_token?: string; msg?: string }
        if (data.code !== 0) return c.json({ ok: false, error: data.msg ?? "凭证无效" })
        return c.json({ ok: true, message: "飞书连接成功" })
      } catch (err) {
        return c.json({ ok: false, error: "网络请求失败" })
      }
    }

    return c.json({ ok: false, error: "该渠道暂不支持测试" })
  })

export { ch as channelRoutes }

const cache = new Map<string, { config: Record<string, unknown>; settings: Record<string, unknown> }>()

export async function resolved(type: string): Promise<{ config: Record<string, unknown>; settings: Record<string, unknown> } | null> {
  if (cache.has(type)) return cache.get(type)!
  try {
    const db = database()
    const row = await channel.byType(db, type)
    if (row?.enabled) {
      const entry = { config: (row.config ?? {}) as Record<string, unknown>, settings: (row.settings ?? {}) as Record<string, unknown> }
      cache.set(type, entry)
      return entry
    }
  } catch {}
  return null
}

export function clearCache(type?: string) {
  if (type) cache.delete(type)
  else cache.clear()
}
