import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { health } from "./routes/health"
import { auth } from "./routes/auth"
import { sessions } from "./routes/session"
import { admin } from "./routes/admin"

export function server() {
  const app = new Hono()
    .use(logger())
    .use(cors())
    .route("/health", health)
    .route("/api/auth", auth)
    .route("/api/sessions", sessions)
    .route("/api/admin", admin)

  return app
}

export type App = ReturnType<typeof server>
