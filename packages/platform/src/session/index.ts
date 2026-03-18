import { eq, desc } from "drizzle-orm"
import { enterprise_session } from "./session.sql"
import { enterprise_message } from "./message.sql"
import { enterprise_tool_log } from "./tool-log.sql"
import * as cache from "./cache"
import type { Database } from "@/db"

export type Session = typeof enterprise_session.$inferSelect
export type Message = typeof enterprise_message.$inferSelect
export type ToolLog = typeof enterprise_tool_log.$inferSelect

export { enterprise_session } from "./session.sql"
export { enterprise_message } from "./message.sql"
export { enterprise_tool_log } from "./tool-log.sql"

export async function create(
  db: Database,
  input: { user_id: string; title?: string; mcp_snapshot?: unknown; system_prompt?: string },
): Promise<Session> {
  const [session] = await db.insert(enterprise_session).values(input).returning()
  if (!session) throw new Error("session create failed")
  return session
}

export async function messages(db: Database, sessionId: string): Promise<Message[]> {
  const cached = await cache.get(sessionId)
  if (cached) {
    await cache.extend(sessionId)
    return cached
  }
  const rows = await db
    .select()
    .from(enterprise_message)
    .where(eq(enterprise_message.session_id, sessionId))
    .orderBy(enterprise_message.created_at)
  await cache.set(sessionId, rows)
  return rows
}

export async function addMessage(
  db: Database,
  input: {
    session_id: string
    role: string
    content: unknown
    tokens_input?: number
    tokens_output?: number
    tokens_cached?: number
    cost_usd?: string
    model_id?: string
    provider_id?: string
    duration_ms?: number
  },
): Promise<Message> {
  const [msg] = await db
    .insert(enterprise_message)
    .values(input as any)
    .returning()
  if (!msg) throw new Error("message insert failed")
  await cache.invalidate(input.session_id)
  return msg
}

export async function logTool(
  db: Database,
  input: {
    session_id: string
    message_id: string
    tool_name: string
    mcp_name?: string
    input?: unknown
    output?: unknown
    status: string
    duration_ms?: number
    user_id: string
  },
): Promise<ToolLog> {
  const [log] = await db
    .insert(enterprise_tool_log)
    .values(input as any)
    .returning()
  if (!log) throw new Error("tool log insert failed")
  return log
}

export function listSessions(db: Database, userId: string, opts?: { limit?: number; offset?: number }) {
  let query = db
    .select()
    .from(enterprise_session)
    .where(eq(enterprise_session.user_id, userId))
    .orderBy(desc(enterprise_session.updated_at))
  if (opts?.limit) query = query.limit(opts.limit) as any
  if (opts?.offset) query = query.offset(opts.offset) as any
  return query
}

export async function remove(db: Database, id: string) {
  await db.update(enterprise_session).set({ status: "deleted" }).where(eq(enterprise_session.id, id))
  await cache.invalidate(id)
}
