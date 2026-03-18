import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as quota from "@/billing/quota"
import * as audit from "@/billing/audit"

const billing = new Hono().use("/*", auth)

billing.get("/quotas", requireRole("admin", "manager"), async (c) => {
  const db = database()
  const configs = await quota.listConfigs(db)
  return c.json({ quotas: configs })
})

billing.get("/quotas-with-usage", requireRole("admin", "manager"), async (c) => {
  const configs = await quota.listConfigs(database())
  const items = await Promise.all(
    configs.map(async (cfg) => {
      const u = await quota.usage(cfg.scope_type, cfg.scope_id, cfg.period)
      return {
        ...cfg,
        tokens_used: u.tokens,
        requests_used: u.requests,
        cost_used: u.cost,
      }
    }),
  )
  return c.json({ quotas: items })
})

billing.post(
  "/quotas",
  requireRole("admin"),
  zValidator(
    "json",
    z.object({
      scope_type: z.string(),
      scope_id: z.string(),
      period: z.string(),
      max_tokens: z.number(),
      max_requests: z.number().optional(),
      max_cost_usd: z.string().optional(),
      enabled: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const db = database()
    const body = c.req.valid("json")
    const cfg = await quota.upsertConfig(db, body)
    return c.json({ quota: cfg }, 201)
  },
)

billing.get("/usage", async (c) => {
  const user = c.get("user")
  const period = c.req.query("period") ?? "monthly"
  const data = await quota.usage("user", user.sub, period)
  return c.json({ usage: data })
})

billing.get("/usage/:scope/:id", requireRole("admin", "manager"), async (c) => {
  const period = c.req.query("period") ?? "monthly"
  const data = await quota.usage(c.req.param("scope"), c.req.param("id"), period)
  return c.json({ usage: data })
})

billing.get("/audit", requireRole("admin", "manager"), async (c) => {
  const db = database()
  const opts = {
    userId: c.req.query("user_id"),
    action: c.req.query("action"),
    from: c.req.query("from") ? new Date(c.req.query("from")!) : undefined,
    to: c.req.query("to") ? new Date(c.req.query("to")!) : undefined,
    limit: Number(c.req.query("limit") ?? 50),
    offset: Number(c.req.query("offset") ?? 0),
  }
  const logs = await audit.query(db, opts)
  return c.json({ audit: logs })
})

export { billing as billingRoutes }
