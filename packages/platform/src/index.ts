import { server } from "./server"
import * as health from "./mcp-manager/health"
import * as sync from "./billing/sync"
import * as audit from "./billing/audit"

const port = Number(process.env.PORT ?? 3100)

const app = server()
health.start()
sync.start()
audit.startFlush()

console.log(`[platform] starting on :${port}`)

export default {
  port,
  fetch: app.fetch,
}
