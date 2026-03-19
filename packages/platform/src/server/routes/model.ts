import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as model from "@/model/model"

export const modelRoutes = new Hono()
  .use(auth)
  .get("/", async (c) => {
    const db = database()
    const models = await model.enabled(db)
    return c.json({ models })
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
