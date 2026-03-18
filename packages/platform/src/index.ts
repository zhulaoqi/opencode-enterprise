import { server } from "./server"
import * as health from "./mcp-manager/health"

const port = Number(process.env.PORT ?? 3100)

const app = server()
health.start()

console.log(`[platform] starting on :${port}`)

export default {
  port,
  fetch: app.fetch,
}
