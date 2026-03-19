import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { auth } from "@/auth/middleware"
import { database } from "@/db"
import * as session from "@/session"

export const sessions = new Hono()
  .use(auth)
  .get("/", async (c) => {
    const user = c.get("user")
    const db = database()
    const limit = Number(c.req.query("limit") ?? 50)
    const offset = Number(c.req.query("offset") ?? 0)
    const rows = await session.listSessions(db, user.sub, { limit, offset })
    return c.json(rows)
  })
  .post(
    "/",
    zValidator("json", z.object({ title: z.string().optional() })),
    async (c) => {
      const user = c.get("user")
      const db = database()
      const { title } = c.req.valid("json")
      const row = await session.create(db, { user_id: user.sub, title })
      return c.json(row, 201)
    },
  )
  .get("/:id", async (c) => {
    const db = database()
    const msgs = await session.messages(db, c.req.param("id"))
    return c.json(msgs)
  })
  .put(
    "/:id",
    zValidator("json", z.object({ title: z.string().optional() })),
    async (c) => {
      const db = database()
      const body = c.req.valid("json")
      const row = await session.update(db, c.req.param("id"), body)
      if (!row) return c.json({ error: "Not found" }, 404)
      return c.json(row)
    },
  )
  .delete("/:id", async (c) => {
    const db = database()
    await session.remove(db, c.req.param("id"))
    return c.json({ ok: true })
  })
