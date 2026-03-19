import { eq } from "drizzle-orm"
import { channel_config } from "./channel.sql"
import type { Database } from "@/db"

export type Channel = typeof channel_config.$inferSelect
export type ChannelType = "feishu" | "dingtalk" | "wecom"

type FeishuConfig = { app_id: string; app_secret: string; verification_token?: string; encrypt_key?: string }
type DingtalkConfig = { agent_id: string; app_key: string; app_secret: string }
type WecomConfig = { corp_id: string; agent_id: string; secret: string; token?: string; encoding_aes_key?: string }
export type ChannelConfig = FeishuConfig | DingtalkConfig | WecomConfig
export type ChannelSettings = { auto_register?: boolean }

const MASK = "••••••••"

export function list(db: Database) {
  return db.select().from(channel_config)
}

export function byType(db: Database, type: string) {
  return db
    .select()
    .from(channel_config)
    .where(eq(channel_config.type, type))
    .then((r) => r[0])
}

export async function upsert(
  db: Database,
  type: string,
  data: { enabled?: boolean; config?: Record<string, unknown>; settings?: Record<string, unknown> },
) {
  const existing = await byType(db, type)
  if (existing) {
    const merged = { ...data, updated_at: new Date() }
    if (data.config) {
      const prev = (existing.config ?? {}) as Record<string, unknown>
      const next = { ...prev }
      for (const [k, v] of Object.entries(data.config)) {
        if (typeof v === "string" && v === MASK) continue
        next[k] = v
      }
      merged.config = next
    }
    const [row] = await db
      .update(channel_config)
      .set(merged)
      .where(eq(channel_config.type, type))
      .returning()
    return row
  }
  const [row] = await db
    .insert(channel_config)
    .values({ type, enabled: data.enabled ?? false, config: data.config ?? {}, settings: data.settings ?? {} })
    .returning()
  return row
}

export async function remove(db: Database, type: string) {
  return db.delete(channel_config).where(eq(channel_config.type, type))
}

export async function touch(db: Database, type: string) {
  return db
    .update(channel_config)
    .set({ last_event: new Date() })
    .where(eq(channel_config.type, type))
}

const SECRET_KEYS = new Set(["app_secret", "secret", "encrypt_key", "encoding_aes_key"])

export function sanitize(ch: Channel): Channel {
  const cfg = { ...((ch.config ?? {}) as Record<string, unknown>) }
  for (const k of SECRET_KEYS) {
    if (cfg[k] && typeof cfg[k] === "string" && (cfg[k] as string).length > 0) {
      cfg[k] = MASK
    }
  }
  return { ...ch, config: cfg }
}
