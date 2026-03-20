import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { auth } from "@/auth/middleware"
import * as manager from "@/worker-manager/manager"
import * as registry from "@/worker-manager/registry"

export const workerRoutes = new Hono()
  .use("/*", auth)
  .get("/connect", async (c) => {
    const uid = c.get("user").sub!
    let worker: Awaited<ReturnType<typeof manager.get>>
    try {
      worker = await manager.get(uid)
    } catch (e) {
      console.error("[connect] spawn failed:", e)
      throw new HTTPException(503, { message: "Worker failed to start" })
    }
    if (!await manager.healthy(worker.port))
      throw new HTTPException(503, { message: "Worker not ready" })
    return c.json({ url: `http://localhost:${worker.port}` })
  })
  .all("/proxy/*", async (c) => {
    const uid = c.get("user").sub!
    let worker: Awaited<ReturnType<typeof manager.get>>
    try {
      worker = await manager.get(uid)
    } catch (e) {
      console.error("[proxy] worker unavailable:", e)
      throw new HTTPException(502, { message: "Worker unavailable" })
    }
    const idx = c.req.path.indexOf("/proxy")
    const sub = c.req.path.substring(idx + "/proxy".length) || "/"
    const query = c.req.url.includes("?") ? "?" + c.req.url.split("?")[1] : ""
    const target = `http://localhost:${worker.port}${sub}${query}`
    const headers = new Headers(c.req.raw.headers)
    headers.delete("host")
    let resp: Response
    try {
      resp = await fetch(target, {
        method: c.req.method,
        headers,
        body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined,
        duplex: "half",
      })
    } catch {
      throw new HTTPException(502, { message: "Worker unreachable" })
    }
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    })
  })
  .get("/resolve", async (c) => {
    const uid = c.req.query("uid") ?? ""
    const entry = await registry.get(uid)
    if (!entry) return c.text("Not found", 404)
    c.header("X-Worker-Port", String(entry.port))
    return c.text("ok")
  })
