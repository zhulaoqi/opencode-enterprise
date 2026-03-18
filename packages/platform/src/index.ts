import { server } from "./server"
import { env } from "./env"

const port = Number(process.env.PORT ?? 3100)

const app = server()

console.log(`[platform] starting on :${port}`)

export default {
  port,
  fetch: app.fetch,
}
