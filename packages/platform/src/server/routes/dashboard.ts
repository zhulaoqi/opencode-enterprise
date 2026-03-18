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
  else from.setMonth(from.getMonth() - 1)
  const data = await dashboard.overview(db, from, new Date())
  return c.json(data)
})

dash.get("/by-department", async (c) => {
  const db = database()
  const data = await dashboard.usageByDepartment(db, "monthly")
  return c.json({ departments: data })
})

dash.get("/top-tools", async (c) => {
  const db = database()
  const days = Number(c.req.query("days") ?? 30)
  const from = new Date()
  from.setDate(from.getDate() - days)
  const data = await dashboard.topTools(db, from)
  return c.json({ tools: data })
})

dash.get("/trend", async (c) => {
  const db = database()
  const days = Number(c.req.query("days") ?? 30)
  const data = await dashboard.dailyTrend(db, days)
  return c.json({ trend: data })
})

export { dash as dashboardRoutes }
