import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as registry from "@/mcp-manager/registry"
import * as resolver from "@/mcp-manager/resolver"
import * as watcher from "@/mcp-manager/watcher"
import * as dashboard from "@/billing/dashboard"

const mcp = new Hono().use("/*", auth)

mcp.get("/market", async (c) => {
  const user = c.get("user")
  const db = database()
  const items = await resolver.market(db, {
    internal_id: user.sub,
    roles: user.roles,
    dept_ids: user.depts,
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
  const mcpEntry = await registry.byId(db, c.req.param("id"))
  if (!mcpEntry) return c.json({ error: "Not found" }, 404)
  const auths = await registry.authorizations(db, mcpEntry.id)
  return c.json({ mcp: mcpEntry, authorizations: auths })
})

mcp.get("/:id/health", async (c) => {
  const db = database()
  const mcpEntry = await registry.byId(db, c.req.param("id"))
  if (!mcpEntry) return c.json({ error: "Not found" }, 404)
  return c.json({ status: mcpEntry.health_status, checked_at: mcpEntry.last_health_at })
})

mcp.get("/:id/usage", async (c) => {
  const db = database()
  const mcpEntry = await registry.byId(db, c.req.param("id"))
  if (!mcpEntry) return c.json({ error: "Not found" }, 404)
  const days = Number(c.req.query("days") ?? 7)
  const trend = await dashboard.mcpUsageTrend(db, mcpEntry.name, days)
  return c.json({ trend })
})

mcp.get("/:id/tools", async (c) => {
  const db = database()
  const mcpEntry = await registry.byId(db, c.req.param("id"))
  if (!mcpEntry) return c.json({ error: "Not found" }, 404)
  const tools = await dashboard.mcpTools(db, mcpEntry.name)
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
    const mcpEntry = await registry.create(db, { ...body, owner_id: user.sub })
    return c.json({ mcp: mcpEntry }, 201)
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

mcp.post(
  "/:id/authorize",
  zValidator(
    "json",
    z.object({
      grantee_type: z.enum(["user", "role", "department"]),
      grantee_id: z.string(),
      permission: z.string().optional(),
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
    const authEntry = await registry.authorize(db, {
      mcp_id: c.req.param("id"),
      grantee_type: body.grantee_type,
      grantee_id: body.grantee_id,
      permission: body.permission ?? "use",
      granted_by: user.sub,
    })
    await watcher.publish(body.grantee_id, [existing.name], [])
    return c.json({ authorization: authEntry }, 201)
  },
)

mcp.delete(
  "/:id/authorize",
  zValidator(
    "json",
    z.object({
      grantee_type: z.string(),
      grantee_id: z.string(),
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
    await registry.revoke(db, c.req.param("id"), body.grantee_type, body.grantee_id)
    await watcher.publish(body.grantee_id, [], [existing.name])
    return c.json({ ok: true })
})

export { mcp as mcpRoutes }
