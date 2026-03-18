import { database } from "@/db"
import { audit_log } from "./audit.sql"
import { quota_usage } from "./quota.sql"
import { enterprise_session } from "../session/session.sql"
import { sql, eq, gte, count, sum } from "drizzle-orm"
import type { Database } from "@/db"

export async function overview(db: Database, from: Date, to: Date) {
  const [tokens, cost, sessions, users] = await Promise.all([
    db
      .select({ total: sum(quota_usage.tokens_used) })
      .from(quota_usage)
      .where(gte(quota_usage.updated_at, from)),
    db
      .select({ total: sum(quota_usage.cost_usd) })
      .from(quota_usage)
      .where(gte(quota_usage.updated_at, from)),
    db
      .select({ total: count() })
      .from(enterprise_session)
      .where(gte(enterprise_session.created_at, from)),
    db
      .select({ total: sql<number>`count(distinct ${enterprise_session.user_id})` })
      .from(enterprise_session)
      .where(gte(enterprise_session.created_at, from)),
  ])
  return {
    total_tokens: Number(tokens[0]?.total ?? 0),
    total_cost: Number(cost[0]?.total ?? 0),
    total_sessions: Number(sessions[0]?.total ?? 0),
    active_users: Number(users[0]?.total ?? 0),
  }
}

export async function usageByDepartment(db: Database, period: string) {
  return db
    .select({
      scope_id: quota_usage.scope_id,
      tokens: sum(quota_usage.tokens_used),
      cost: sum(quota_usage.cost_usd),
    })
    .from(quota_usage)
    .where(eq(quota_usage.scope_type, "department"))
    .groupBy(quota_usage.scope_id)
}

export async function topTools(db: Database, from: Date, limit = 10) {
  const rows = await db.execute(sql`
    SELECT elem->>'name' as tool, count(*)::int as calls
    FROM audit_log, jsonb_array_elements(COALESCE(tools, '[]'::jsonb)) as elem
    WHERE created_at >= ${from}
    GROUP BY elem->>'name'
    ORDER BY count(*) DESC
    LIMIT ${limit}
  `)
  return rows.rows as { tool: string; calls: number }[]
}

export async function dailyTrend(db: Database, days = 30) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  const rows = await db.execute(sql`
    SELECT date_trunc('day', created_at)::date as day,
      coalesce(sum(tokens_input), 0)::bigint as tokens_in,
      coalesce(sum(tokens_output), 0)::bigint as tokens_out,
      coalesce(sum(cost_usd), 0)::numeric as cost,
      count(*)::int as requests
    FROM audit_log
    WHERE created_at >= ${from}
    GROUP BY date_trunc('day', created_at)::date
    ORDER BY day
  `)
  return rows.rows as { day: Date; tokens_in: number; tokens_out: number; cost: number; requests: number }[]
}
