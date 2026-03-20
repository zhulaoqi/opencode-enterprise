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
  .all("/proxy/*", async (c) => {
    const uid = c.get("user").sub!
    const worker = await manager.get(uid)
    const idx = c.req.path.indexOf("/proxy")
    const path = c.req.path.substring(idx + "/proxy".length) || "/"
    const query = c.req.url.includes("?") ? "?" + c.req.url.split("?")[1] : ""
    const target = `http://localhost:${worker.port}${path}${query}`
    const headers = new Headers(c.req.raw.headers)
    headers.delete("host")
    const resp = await fetch(target, {
      method: c.req.method,
      headers,
      body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined,
      duplex: "half",
    })
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
