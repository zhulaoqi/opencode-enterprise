import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { health } from "./routes/health"
import { auth } from "./routes/auth"
import { sessions } from "./routes/session"
import { admin } from "./routes/admin"
import { mcpRoutes } from "./routes/mcp"
import { billingRoutes } from "./routes/billing"
import { dashboardRoutes } from "./routes/dashboard"
import { imRoutes } from "./routes/im"

export function server() {
  const app = new Hono()
    .use(logger())
    .use(cors())
    .route("/health", health)
    .route("/api/auth", auth)
    .route("/api/sessions", sessions)
    .route("/api/admin", admin)
    .route("/api/mcp", mcpRoutes)
    .route("/api/billing", billingRoutes)
    .route("/api/dashboard", dashboardRoutes)
    .route("/api/im", imRoutes)

  return app
}

export type App = ReturnType<typeof server>
