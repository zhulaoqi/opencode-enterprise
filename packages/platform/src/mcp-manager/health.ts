import { eq } from "drizzle-orm"
import { database } from "@/db"
import { mcp_registry } from "./registry.sql"
import * as registry from "./registry"
import * as pool from "./pool"

const INTERVAL = 60_000
let timer: ReturnType<typeof setInterval> | undefined

export function start() {
  if (timer) return
  timer = setInterval(check, INTERVAL)
  check()
}

export function stop() {
  if (timer) clearInterval(timer)
  timer = undefined
}

async function check() {
  const db = database()
  const mcps = await db.select().from(mcp_registry).where(eq(mcp_registry.enabled, true))

  for (const mcp of mcps) {
    const status = await ping(mcp)
    if (status !== mcp.health_status) {
      await registry.updateHealth(db, mcp.id, status)
    }
  }
}

async function ping(mcp: { id: string; name: string; config: unknown }): Promise<string> {
  try {
    const client = await pool.acquire(mcp.name, mcp.config)
    const tools = await client.listTools()
    await pool.release(mcp.name)
    return tools.tools.length > 0 ? "healthy" : "degraded"
  } catch {
    return "down"
  }
}

export { check as checkNow }
