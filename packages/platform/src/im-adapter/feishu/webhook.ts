import type { ImMessage } from "../types"

export function verifySignature(body: unknown, verificationToken: string): boolean {
  return (body as any)?.token === verificationToken
}

export function isVerification(body: unknown): boolean {
  return (body as any)?.type === "url_verification"
}

export function challenge(body: unknown): string {
  return (body as any)?.challenge ?? ""
}

export function parse(body: unknown): ImMessage | null {
  const b = body as any
  const event = b?.event
  if (!event) return null
  const msg = event.message
  if (!msg) return null

  let content = ""
  try {
    const parsed = JSON.parse(msg.content ?? "{}")
    content = parsed.text ?? ""
  } catch {
    content = msg.content ?? ""
  }

  content = content.replace(/@_user_\d+/g, "").trim()

  const uid = event.sender?.sender_id?.user_id
  return {
    source: "feishu",
    user_external_id: uid ?? "",
    chat_id: msg.chat_id ?? "",
    chat_type: msg.chat_type === "group" ? "group" : "private",
    content,
    message_id: msg.message_id,
    mentions: uid ? [uid] : [],
    metadata: { raw: body },
  }
}
