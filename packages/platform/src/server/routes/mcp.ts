import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as registry from "@/mcp-manager/registry"
import * as resolver from "@/mcp-manager/resolver"
import * as member from "@/mcp-manager/member"
import * as watcher from "@/mcp-manager/watcher"
import * as dashboard from "@/billing/dashboard"

const mcp = new Hono().use("/*", auth)

mcp.get("/market", async (c) => {
  const user = c.get("user")
  const db = database()
  const items = await resolver.market(db, {
    internal_id: user.sub,
  })
  return c.json({ mcps: items })
})

mcp.get("/groups", async (c) => {
  const db = database()
  const list = await registry.groups(db)
  return c.json({ groups: list })
})

mcp.get("/:id", async (c) => {
  const db = database()
  const id = c.req.param("id")
  const entry = await registry.byId(db, id)
  if (!entry) return c.json({ error: "Not found" }, 404)
  const list = await member.members(db, entry.id)
  return c.json({ mcp: entry, members: list })
})

mcp.get("/:id/health", async (c) => {
  const db = database()
  const entry = await registry.byId(db, c.req.param("id"))
  if (!entry) return c.json({ error: "Not found" }, 404)
  return c.json({ status: entry.health_status, checked_at: entry.last_health_at })
})

mcp.get("/:id/usage", async (c) => {
  const db = database()
  const entry = await registry.byId(db, c.req.param("id"))
  if (!entry) return c.json({ error: "Not found" }, 404)
  const days = Number(c.req.query("days") ?? 7)
  const trend = await dashboard.mcpUsageTrend(db, entry.name, days)
  return c.json({ trend })
})

mcp.get("/:id/tools", async (c) => {
  const db = database()
  const entry = await registry.byId(db, c.req.param("id"))
  if (!entry) return c.json({ error: "Not found" }, 404)
  const tools = await dashboard.mcpTools(db, entry.name)
  return c.json({ tools })
})

mcp.post(
  "/",
  requireRole("admin"),
  zValidator(
    "json",
    z.object({
      name: z.string(),
      display_name: z.string(),
      description: z.string().optional(),
      type: z.string(),
      config: z.record(z.string(), z.unknown()),
      visibility: z.enum(["PUBLIC", "PRIVATE", "SHARED"]).optional(),
      group_id: z.string().uuid().optional(),
      tags: z.array(z.string()).optional(),
    }),
  ),
  async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")
    const db = database()
    const entry = await registry.create(db, { ...body, owner_id: user.sub })
    return c.json({ mcp: entry }, 201)
  },
)

mcp.put(
  "/:id",
  zValidator(
    "json",
    z.object({
      display_name: z.string().optional(),
      description: z.string().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      visibility: z.enum(["PUBLIC", "PRIVATE", "SHARED"]).optional(),
      enabled: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const user = c.get("user")
    const db = database()
    const existing = await registry.byId(db, c.req.param("id"))
    if (!existing) return c.json({ error: "Not found" }, 404)
    if (existing.owner_id !== user.sub && !user.roles.includes("admin")) {
      return c.json({ error: "Forbidden" }, 403)
    }
    const body = c.req.valid("json")
    const updated = await registry.update(db, c.req.param("id"), body)
    return c.json({ mcp: updated })
  },
)

mcp.delete("/:id", async (c) => {
  const user = c.get("user")
  const db = database()
  const existing = await registry.byId(db, c.req.param("id"))
  if (!existing) return c.json({ error: "Not found" }, 404)
  if (existing.owner_id !== user.sub && !user.roles.includes("admin")) {
    return c.json({ error: "Forbidden" }, 403)
  }
  await registry.remove(db, c.req.param("id"))
  return c.json({ ok: true })
})

mcp.get("/:id/members", async (c) => {
  const db = database()
  const id = c.req.param("id")
  const list = await member.members(db, id)
  return c.json({ members: list })
})

mcp.post(
  "/:id/members",
  zValidator(
    "json",
    z.object({
      user_ids: z.array(z.string()),
      role: z.string().optional(),
    }),
  ),
  async (c) => {
    const user = c.get("user")
    const db = database()
    const id = c.req.param("id")
    const admin = await member.isAdmin(db, id, user.sub)
    if (!admin) return c.json({ error: "Forbidden" }, 403)
    const body = c.req.valid("json")
    await member.add(db, id, body.user_ids, body.role ?? "user", user.sub)
    return c.json({ ok: true }, 201)
  },
)

mcp.put(
  "/:id/members/:uid",
  zValidator("json", z.object({ role: z.string() })),
  async (c) => {
    const user = c.get("user")
    const db = database()
    const id = c.req.param("id")
    const admin = await member.isAdmin(db, id, user.sub)
    if (!admin) return c.json({ error: "Forbidden" }, 403)
    const uid = c.req.param("uid")
    const body = c.req.valid("json")
    const updated = await member.updateRole(db, id, uid, body.role)
    return c.json({ member: updated })
  },
)

mcp.delete("/:id/members/:uid", async (c) => {
  const user = c.get("user")
  const db = database()
  const id = c.req.param("id")
  const admin = await member.isAdmin(db, id, user.sub)
  if (!admin) return c.json({ error: "Forbidden" }, 403)
  const uid = c.req.param("uid")
  await member.remove(db, id, uid)
  return c.json({ ok: true })
})

mcp.post(
  "/:id/apply",
  zValidator("json", z.object({ reason: z.string().optional() })),
  async (c) => {
    const user = c.get("user")
    const db = database()
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const app = await member.apply(db, id, user.sub, body.reason)
    return c.json({ application: app }, 201)
  },
)

mcp.get("/:id/applications", async (c) => {
  const user = c.get("user")
  const db = database()
  const id = c.req.param("id")
  const admin = await member.isAdmin(db, id, user.sub)
  if (!admin) return c.json({ error: "Forbidden" }, 403)
  const list = await member.applications(db, id)
  return c.json({ applications: list })
})

mcp.put(
  "/:id/applications/:aid",
  zValidator("json", z.object({ approved: z.boolean() })),
  async (c) => {
    const user = c.get("user")
    const db = database()
    const id = c.req.param("id")
    const admin = await member.isAdmin(db, id, user.sub)
    if (!admin) return c.json({ error: "Forbidden" }, 403)
    const aid = c.req.param("aid")
    const body = c.req.valid("json")
    await member.review(db, aid, body.approved, user.sub)
    return c.json({ ok: true })
  },
)

export { mcp as mcpRoutes }
