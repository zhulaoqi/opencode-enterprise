import { server } from "./server"
import * as health from "./mcp-manager/health"
import * as sync from "./billing/sync"
import * as audit from "./billing/audit"
import * as ws from "./server/ws"
import * as wsSubscribe from "./server/ws-subscribe"
import { FeishuAdapter } from "./im-adapter/feishu/adapter"
import * as adapterRegistry from "./im-adapter/registry"
import { register as registerHooks } from "./hooks/register"
import { start as startWorker } from "./worker/consumer"

const port = Number(process.env.PORT ?? 3100)
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 4)

registerHooks()
adapterRegistry.register(new FeishuAdapter())
wsSubscribe.start()

const app = server()
health.start()
sync.start()
audit.startFlush()

const worker = startWorker(concurrency)
ws.startSweeper()
console.log(`[worker] started with concurrency=${concurrency}`)

function fetch(req: Request, server: { upgrade: (r: Request, opts?: { data?: unknown }) => boolean }) {
  const url = new URL(req.url)
  if (url.pathname === "/ws") {
    const res = ws.upgrade(req, server)
    if (res) return res
    return undefined as unknown as Response
  }
  return app.fetch(req)
}

console.log(`[platform] starting on :${port}`)

export default {
  port,
  fetch: (req: Request, s: { upgrade: (r: Request, opts?: { data?: unknown }) => boolean }) =>
    fetch(req, s),
  websocket: {
    open: ws.handlers.open,
    message: ws.handlers.message,
    close: ws.handlers.close,
  },
}
