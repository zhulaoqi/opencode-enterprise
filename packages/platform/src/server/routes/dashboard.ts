import { Hono } from "hono"
import { auth, requireRole } from "@/auth/middleware"
import { database } from "@/db"
import * as dashboard from "@/billing/dashboard"

const dash = new Hono().use("/*", auth).use("/*", requireRole("admin", "manager"))

dash.get("/overview", async (c) => {
  const db = database()
  const range = c.req.query("range") ?? "month"
  const from = new Date()
  if (range === "day") from.setDate(from.getDate() - 1)
  else if (range === "week") from.setDate(from.getDate() - 7)
  else if (range === "quarter") from.setMonth(from.getMonth() - 3)
  else from.setMonth(from.getMonth() - 1)
  const data = await dashboard.overview(db, from, new Date())
  return c.json(data)
})

dash.get("/trend", async (c) => {
  const db = database()
  const days = Number(c.req.query("days") ?? 30)
  const data = await dashboard.dailyTrend(db, days)
  return c.json({ trend: data })
})

dash.get("/active-users", async (c) => {
  const db = database()
  const range = c.req.query("range") ?? "week"
  const data = await dashboard.activeUsers(db, range)
  return c.json({ users: data })
})

dash.get("/mcp-leaderboard", async (c) => {
  const db = database()
  const range = c.req.query("range") ?? "week"
  const data = await dashboard.mcpLeaderboard(db, range)
  return c.json({ mcps: data })
})

dash.get("/model-distribution", async (c) => {
  const db = database()
  const range = c.req.query("range") ?? "week"
  const data = await dashboard.modelDistribution(db, range)
  return c.json({ models: data })
})

dash.get("/top-tools", async (c) => {
  const db = database()
  const days = Number(c.req.query("days") ?? 30)
  const from = new Date()
  from.setDate(from.getDate() - days)
  const data = await dashboard.topTools(db, from)
  return c.json({ tools: data })
})

dash.get("/recent-activity", async (c) => {
  const db = database()
  const data = await dashboard.recentActivity(db)
  return c.json({ activity: data })
})

export { dash as dashboardRoutes }
