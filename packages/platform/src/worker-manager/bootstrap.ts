import { setUserId } from "../hooks/context"
import { register } from "../hooks/register"

const uid = process.env.WORKER_USER_ID
const port = parseInt(process.env.WORKER_PORT ?? "4200")

if (!uid) {
  console.error("[bootstrap] WORKER_USER_ID is required")
  process.exit(1)
}

process.env.AGENT = "1"
process.env.OPENCODE = "1"
process.env.OPENCODE_PID = String(process.pid)
process.env.OPENCODE_SERVER_PASSWORD = process.env.WORKER_SECRET ?? ""

if (process.env.WORKER_CONFIG) {
  process.env.OPENCODE_CONFIG_CONTENT = process.env.WORKER_CONFIG
}

setUserId(uid)
register()

const { Server } = await import("opencode/server/server")
const server = Server.listen({ port, hostname: "0.0.0.0" })
console.log(`[worker] uid=${uid} listening on :${server.port}`)

await new Promise(() => {})
