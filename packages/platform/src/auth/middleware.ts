import { createMiddleware } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import { verify, type JwtPayload } from "./jwt"
import { env } from "@/env"

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload
  }
}

export const auth = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization")
  const token = header?.startsWith("Bearer ") ? header.slice(7) : c.req.query("token")
  if (!token) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" })
  }
  try {
    const payload = await verify(token, env().JWT_SECRET)
    if (!payload.sub) throw new Error("missing sub")
    c.set("user", payload)
    await next()
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" })
  }
})

export const requireRole = (...roles: string[]) =>
  createMiddleware(async (c, next) => {
    const user = c.get("user")
    if (!user) throw new HTTPException(401, { message: "Not authenticated" })
    const has = user.roles.some((r) => roles.includes(r))
    if (!has) throw new HTTPException(403, { message: "Insufficient permissions" })
    await next()
  })
