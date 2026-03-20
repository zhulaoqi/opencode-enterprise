import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as identity from "@/auth/identity"
import * as role from "@/rbac/role"
import * as manager from "@/worker-manager/manager"
import * as registryMod from "@/worker-manager/registry"
import * as metrics from "@/worker-manager/metrics"

export const admin = new Hono()
  .use(auth)
  .use(requireRole("admin", "manager"))
  .get("/users", async (c) => {
    const db = database()
    const limit = Number(c.req.query("limit") ?? 20)
    const offset = Number(c.req.query("offset") ?? 0)
    const search = c.req.query("search") ?? ""
    const rows = await identity.list(db, { limit, offset, search: search || undefined })
    return c.json(rows)
  })
  .get("/roles", async (c) => {
    const db = database()
    const rows = await role.all(db)
    return c.json(rows)
  })
  .get("/users/:id/roles", async (c) => {
    const db = database()
    const rows = await role.userRoles(db, c.req.param("id"))
    return c.json({ roles: rows })
  })
  .post(
    "/roles/assign",
    zValidator(
      "json",
      z.object({
        user_id: z.string().uuid(),
        role_id: z.string().uuid(),
      }),
    ),
    async (c) => {
      const db = database()
      const { user_id, role_id } = c.req.valid("json")
      await role.assignRole(db, user_id, role_id)
      return c.json({ ok: true })
    },
  )
  .delete("/users/:id/roles/:roleId", async (c) => {
    const db = database()
    await role.removeRole(db, c.req.param("id"), c.req.param("roleId"))
    return c.json({ ok: true })
  })
  .post("/seed", async (c) => {
    const db = database()
    await role.seed(db)
    return c.json({ ok: true, message: "roles seeded" })
  })
  .get("/workers", async (c) => {
    const db = database()
    const entries = await registryMod.all()
    const result = await Promise.all(
      entries.map(async ([uid, entry]) => {
        const usr = await identity.byInternalId(db, uid)
        const ok = await manager.healthy(entry.port)
        const m = await metrics.read(uid)
        return {
          uid,
          name: usr?.name ?? "Unknown",
          email: usr?.email ?? "",
          avatar: usr?.avatar_url ?? "",
          port: entry.port,
          pid: entry.pid,
          status: ok ? "healthy" : "unhealthy",
          started: entry.started,
          active: entry.active,
          metrics: m,
        }
      }),
    )
    return c.json(result)
  })
  .post("/workers/:uid/restart", requireRole("admin"), async (c) => {
    const uid = c.req.param("uid")
    await manager.stop(uid)
    const worker = await manager.spawn(uid)
    return c.json({ ok: true, port: worker.port })
  })
  .post("/workers/:uid/stop", requireRole("admin"), async (c) => {
    const uid = c.req.param("uid")
    await manager.stop(uid)
    return c.json({ ok: true })
  })
