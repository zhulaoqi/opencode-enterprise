import { env } from "@/env"

const BASE = "https://open.feishu.cn/open-apis"

let token: { value: string; expires: number } | undefined

async function tenantToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value
  const cfg = env()
  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: cfg.FEISHU_APP_ID, app_secret: cfg.FEISHU_APP_SECRET }),
  })
  const data = (await res.json()) as { tenant_access_token: string; expire: number }
  token = { value: data.tenant_access_token, expires: Date.now() + (data.expire - 60) * 1000 }
  return token.value
}

export async function sendText(chatId: string, text: string) {
  const tk = await tenantToken()
  await fetch(`${BASE}/im/v1/messages?receive_id_type=chat_id`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text }),
    }),
  })
}

export async function sendCard(chatId: string, card: unknown) {
  const tk = await tenantToken()
  await fetch(`${BASE}/im/v1/messages?receive_id_type=chat_id`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "interactive",
      content: JSON.stringify(card),
    }),
  })
}

export async function replyMessage(messageId: string, text: string) {
  const tk = await tenantToken()
  await fetch(`${BASE}/im/v1/messages/${messageId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
    body: JSON.stringify({
      msg_type: "text",
      content: JSON.stringify({ text }),
    }),
  })
}

export async function updateCard(messageId: string, card: unknown) {
  const tk = await tenantToken()
  await fetch(`${BASE}/im/v1/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
    body: JSON.stringify({ content: JSON.stringify(card) }),
  })
}
