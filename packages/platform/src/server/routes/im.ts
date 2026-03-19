import { Hono } from "hono"
import * as adapterRegistry from "@/im-adapter/registry"
import * as identity from "@/auth/identity"
import * as producer from "@/worker/producer"
import { database } from "@/db"
import { redis } from "@/redis"
import { isVerification, challenge } from "@/im-adapter/feishu/webhook"

const im = new Hono()

im.post("/feishu/webhook", async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>

  if (isVerification(body)) {
    return c.json({ challenge: challenge(body) })
  }

  const eventId = (body?.header as Record<string, unknown> | undefined)?.event_id as string | undefined
  if (eventId) {
    const r = redis()
    const dup = await r.set(`im:dedup:${eventId}`, "1", "EX", 300, "NX")
    if (!dup) return c.json({ ok: true })
  }

  const adapter = adapterRegistry.get("feishu")
  if (!adapter) return c.json({ error: "Feishu adapter not configured" }, 500)

  const valid = await adapter.verify(c.req.raw, body)
  if (!valid) return c.json({ error: "Invalid signature" }, 403)

  const msg = await adapter.parse(body)
  if (!msg || !msg.content) return c.json({ ok: true })

  const db = database()
  const user = await identity.byFeishuId(db, msg.user_external_id)
  if (!user) {
    await adapter.reply(msg.chat_id, { type: "text", content: "请先完成账号绑定后再使用 AI 助手" })
    return c.json({ ok: true })
  }

  await producer.enqueue({
    user_id: user.internal_id,
    session_id: "",
    message: msg.content,
    source: "feishu",
    callback: {
      chat_id: msg.chat_id,
      message_id: msg.message_id,
    },
  })

  return c.json({ ok: true })
})

im.post("/feishu/card-action", async (c) => {
  const body = (await c.req.json()) as { action?: { value?: { action?: string; session?: string } } }
  const action = body?.action?.value
  if (!action) return c.json({ ok: true })

  if (action.action === "approve" || action.action === "reject") {
    console.log(`[im] card action: ${action.action} for session ${action.session}`)
  }

  return c.json({ ok: true })
})

export { im as imRoutes }
