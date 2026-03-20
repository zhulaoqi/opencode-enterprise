import { server } from "./server"
import * as health from "./mcp-manager/health"
import * as sync from "./billing/sync"
import * as audit from "./billing/audit"
import * as ws from "./server/ws"
import * as wsSubscribe from "./server/ws-subscribe"
import { FeishuAdapter } from "./im-adapter/feishu/adapter"
import * as adapterRegistry from "./im-adapter/registry"
import * as feishuWs from "./im-adapter/feishu/ws-receiver"
import { register as registerHooks } from "./hooks/register"
import * as pool from "./worker-manager/pool"
import * as manager from "./worker-manager/manager"
import * as patrol from "./worker-manager/patrol"
import { close as closeRedis } from "./redis"

const port = Number(process.env.PORT ?? 3100)

registerHooks()
adapterRegistry.register(new FeishuAdapter())
wsSubscribe.start()

const app = server()
health.start()
sync.start()
audit.startFlush()

ws.startSweeper()
pool.start()
manager.recover().catch((e) => console.warn("[worker-manager] recover failed:", e))
patrol.start()
feishuWs.start().catch((e) => console.warn("[feishu-ws] auto-start skipped:", e))

async function shutdown() {
  console.log("[platform] shutting down gracefully...")
  patrol.stop()
  await closeRedis()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

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
