import { env } from "@/env"
import { resolved } from "@/server/routes/channel"

const BASE = "https://open.feishu.cn/open-apis"

let token: { value: string; expires: number } | undefined

async function credentials(): Promise<{ app_id: string; app_secret: string }> {
  const ch = await resolved("feishu")
  if (ch) {
    const cfg = ch.config as Record<string, string>
    if (cfg.app_id && cfg.app_secret) return { app_id: cfg.app_id, app_secret: cfg.app_secret }
  }
  const e = env()
  return { app_id: e.FEISHU_APP_ID, app_secret: e.FEISHU_APP_SECRET }
}

export async function tenantToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value
  const creds = await credentials()
  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: creds.app_id, app_secret: creds.app_secret }),
  })
  const data = (await res.json()) as { tenant_access_token: string; expire: number }
  token = { value: data.tenant_access_token, expires: Date.now() + (data.expire - 60) * 1000 }
  return token.value
}

export function clearToken() {
  token = undefined
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

export async function getUserInfo(userId: string) {
  const tk = await tenantToken()
  const res = await fetch(
    `${BASE}/contact/v3/users/${userId}?user_id_type=user_id`,
    { headers: { Authorization: `Bearer ${tk}` } },
  )
  const raw = (await res.json()) as { code?: number; data?: { user?: Record<string, unknown> } }
  if (raw.code !== 0 || !raw.data?.user) return null
  const u = raw.data.user
  return {
    user_id: String(u.user_id ?? ""),
    union_id: String(u.union_id ?? ""),
    name: String(u.name ?? ""),
    email: String(u.email ?? u.enterprise_email ?? ""),
    avatar_url: String(u.avatar_url ?? ""),
    department_ids: (u.department_ids ?? []) as string[],
  }
}
