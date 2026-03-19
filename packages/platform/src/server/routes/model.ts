import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import { env } from "@/env"
import * as model from "@/model/model"

export const modelRoutes = new Hono()
  .use(auth)
  .get("/", async (c) => {
    const db = database()
    const cfg = env()
    const mid = cfg.LLM_MODEL
    const readable = /^[a-z0-9][-a-z0-9.]*$/i.test(mid) ? mid : "默认模型"
    const fallback = {
      id: "default",
      name: readable,
      model_id: mid,
      provider: "openrouter",
      base_url: cfg.OPENAI_BASE_URL ?? "",
      enabled: true,
      sort_order: -1,
      group: "system" as const,
    }
    const rows = await model.enabled(db)
    const custom = rows.map((r) => ({ ...r, group: "custom" as const }))
    return c.json({ models: [fallback, ...custom] })
  })
  .get("/admin", requireRole("admin"), async (c) => {
    const db = database()
    const models = await model.list(db)
    return c.json({ models })
  })
  .post(
    "/admin",
    requireRole("admin"),
    zValidator(
      "json",
      z.object({
        name: z.string().max(64),
        model_id: z.string().max(128),
        provider: z.string().max(32).default("openai"),
        base_url: z.string().max(512),
        api_key: z.string(),
        enabled: z.boolean().optional(),
        sort_order: z.number().int().optional(),
      }),
    ),
    async (c) => {
      const db = database()
      const row = await model.create(db, c.req.valid("json"))
      return c.json(row, 201)
    },
  )
  .put(
    "/admin/reorder",
    requireRole("admin"),
    zValidator(
      "json",
      z.object({
        order: z.array(z.object({ id: z.string(), sort_order: z.number().int() })),
      }),
    ),
    async (c) => {
      const db = database()
      const { order } = c.req.valid("json")
      await Promise.all(order.map((o) => model.update(db, o.id, { sort_order: o.sort_order })))
      return c.json({ ok: true })
    },
  )
  .put(
    "/admin/:id",
    requireRole("admin"),
    zValidator(
      "json",
      z.object({
        name: z.string().max(64).optional(),
        model_id: z.string().max(128).optional(),
        provider: z.string().max(32).optional(),
        base_url: z.string().max(512).optional(),
        api_key: z.string().optional(),
        enabled: z.boolean().optional(),
        sort_order: z.number().int().optional(),
      }),
    ),
    async (c) => {
      const db = database()
      const row = await model.update(db, c.req.param("id"), c.req.valid("json"))
      return c.json(row)
    },
  )
  .delete("/admin/:id", requireRole("admin"), async (c) => {
    const db = database()
    await model.remove(db, c.req.param("id"))
    return c.json({ ok: true })
  })
