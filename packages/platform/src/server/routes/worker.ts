import { Hono } from "hono"
import { auth } from "@/auth/middleware"
import * as manager from "@/worker-manager/manager"
import * as registry from "@/worker-manager/registry"

export const workerRoutes = new Hono()
  .use("/*", auth)
  .get("/connect", async (c) => {
    const uid = c.get("user").sub!
    const worker = await manager.get(uid)
    const base = process.env.WORKER_BASE_URL
    const url = base
      ? `${base}/${uid}`
      : `http://localhost:${worker.port}`
    return c.json({ url, token: worker.secret })
  })
  .get("/resolve", async (c) => {
    const uid = c.req.query("uid") ?? ""
    const entry = await registry.get(uid)
    if (!entry) return c.text("Not found", 404)
    c.header("X-Worker-Port", String(entry.port))
    return c.text("ok")
  })
