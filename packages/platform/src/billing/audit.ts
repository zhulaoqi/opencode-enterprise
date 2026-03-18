import { database } from "@/db"
import { audit_log } from "./audit.sql"
import { and, desc, eq, gte, lte } from "drizzle-orm"
import type { Database } from "@/db"

type AuditEntry = typeof audit_log.$inferInsert

const buffer: AuditEntry[] = []
let timer: ReturnType<typeof setInterval> | undefined

export function log(entry: AuditEntry) {
  buffer.push(entry)
  if (buffer.length >= 50) flush()
}

export async function flush() {
  if (buffer.length === 0) return
  const batch = buffer.splice(0, buffer.length)
  const db = database()
  await db.insert(audit_log).values(batch)
}

export function startFlush(interval = 5000) {
  timer = setInterval(flush, interval)
}

export function stopFlush() {
  if (timer) clearInterval(timer)
  flush()
}

export function query(
  db: Database,
  opts: {
    userId?: string
    action?: string
    from?: Date
    to?: Date
    limit?: number
    offset?: number
  },
) {
  const conds = []
  if (opts.userId) conds.push(eq(audit_log.user_id, opts.userId))
  if (opts.action) conds.push(eq(audit_log.action, opts.action))
  if (opts.from) conds.push(gte(audit_log.created_at, opts.from))
  if (opts.to) conds.push(lte(audit_log.created_at, opts.to))
  const where = conds.length > 0 ? and(...conds) : undefined
  let q = db.select().from(audit_log)
  if (where) q = q.where(where) as any
  return q.orderBy(desc(audit_log.created_at)).limit(opts.limit ?? 50).offset(opts.offset ?? 0)
}
