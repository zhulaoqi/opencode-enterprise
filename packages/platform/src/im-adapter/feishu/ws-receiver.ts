import * as lark from "@larksuiteoapi/node-sdk"
import * as identity from "@/auth/identity"
import * as producer from "@/worker/producer"
import * as channelMod from "@/channel/channel"
import * as feishuClient from "./client"
import { database } from "@/db"
import { redis } from "@/redis"
import { resolved } from "@/server/routes/channel"

let wsClient: lark.WSClient | null = null

export function running() {
  return !!wsClient
}

export async function start() {
  if (wsClient) return
  const ch = await resolved("feishu")
  if (!ch) return
  const cfg = ch.config as Record<string, string>
  if (!cfg.app_id || !cfg.app_secret) return
  const mode = (ch.settings as Record<string, unknown>)?.mode
  if (mode !== "websocket") return

  console.log("[feishu-ws] starting long connection...")

  const client = new lark.Client({ appId: cfg.app_id, appSecret: cfg.app_secret })

  wsClient = new lark.WSClient({
    appId: cfg.app_id,
    appSecret: cfg.app_secret,
    loggerLevel: lark.LoggerLevel.warn,
  })

  wsClient.start({
    eventDispatcher: new lark.EventDispatcher({}).register({
      "im.message.receive_v1": async (data: unknown) => {
        try {
          await handle(data as Record<string, unknown>, client)
        } catch (e) {
          console.error("[feishu-ws] event handler error:", e)
        }
      },
    }),
  })

  console.log("[feishu-ws] connected")
}

export function stop() {
  if (!wsClient) return
  try {
    wsClient = null
  } catch { /* ignore */ }
  console.log("[feishu-ws] stopped")
}

export async function restart() {
  stop()
  await start()
}

async function handle(data: Record<string, unknown>, _client: lark.Client) {
  const event = data as {
    message?: {
      chat_id?: string
      chat_type?: string
      content?: string
      message_id?: string
    }
    sender?: { sender_id?: { user_id?: string } }
    event_id?: string
  }

  const msg = event.message
  if (!msg?.chat_id) return

  if (event.event_id) {
    const r = redis()
    const dup = await r.set(`im:dedup:${event.event_id}`, "1", "EX", 300, "NX")
    if (!dup) return
  }

  let content = ""
  try {
    const parsed = JSON.parse(msg.content ?? "{}")
    content = parsed.text ?? ""
  } catch {
    content = msg.content ?? ""
  }
  content = content.replace(/@_user_\d+/g, "").trim()
  if (!content) return

  const uid = event.sender?.sender_id?.user_id ?? ""
  const db = database()

  await channelMod.touch(db, "feishu").catch(() => {})

  let user = await identity.byFeishuId(db, uid)

  if (!user) {
    const ch = await resolved("feishu")
    const auto = (ch?.settings as Record<string, unknown>)?.auto_register !== false

    if (auto && uid) {
      const info = await feishuClient.getUserInfo(uid)
      if (info) {
        user = await identity.upsertFromFeishu(db, {
          feishu_user_id: info.user_id,
          feishu_union_id: info.union_id,
          name: info.name || "飞书用户",
          email: info.email,
          avatar_url: info.avatar_url,
          department_ids: info.department_ids,
          job_level: "",
        })
      }
    }

    if (!user) {
      await feishuClient.replyMessage(msg.message_id ?? "", "请先完成账号绑定后再使用 AI 助手")
      return
    }
  }

  await producer.enqueue({
    user_id: user.internal_id,
    session_id: "",
    message: content,
    source: "feishu",
    callback: {
      chat_id: msg.chat_id,
      message_id: msg.message_id,
    },
  })
}
