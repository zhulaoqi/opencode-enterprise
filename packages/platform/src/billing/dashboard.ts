import { audit_log } from "./audit.sql"
import { enterprise_session } from "../session/session.sql"
import { enterprise_message } from "../session/message.sql"
import { identity_mapping } from "../auth/identity.sql"
import { mcp_registry } from "../mcp-manager/registry.sql"
import { sql, gte, count, sum, desc, eq } from "drizzle-orm"
import type { Database } from "@/db"

function since(range: string) {
  const d = new Date()
  if (range === "day") d.setDate(d.getDate() - 1)
  else if (range === "week") d.setDate(d.getDate() - 7)
  else if (range === "quarter") d.setMonth(d.getMonth() - 3)
  else d.setMonth(d.getMonth() - 1)
  return d
}

export async function overview(db: Database, from: Date, _to: Date) {
  const [tokens, cost, sessions, users] = await Promise.all([
    db.select({ total: sum(audit_log.tokens_input) }).from(audit_log).where(gte(audit_log.created_at, from))
      .then(async (inp) => {
        const out = await db.select({ total: sum(audit_log.tokens_output) }).from(audit_log).where(gte(audit_log.created_at, from))
        return Number(inp[0]?.total ?? 0) + Number(out[0]?.total ?? 0)
      }),
    db.select({ total: sum(audit_log.cost_usd) }).from(audit_log).where(gte(audit_log.created_at, from)),
    db.select({ total: count() }).from(enterprise_session).where(gte(enterprise_session.created_at, from)),
    db.select({ total: sql<number>`count(distinct ${enterprise_session.user_id})` }).from(enterprise_session).where(gte(enterprise_session.created_at, from)),
  ])
  return {
    total_tokens: tokens,
    total_cost: Number(cost[0]?.total ?? 0),
    total_sessions: Number(sessions[0]?.total ?? 0),
    active_users: Number(users[0]?.total ?? 0),
  }
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

export async function activeUsers(db: Database, range: string, limit = 10) {
  const from = since(range)
  const rows = await db.execute(sql`
    SELECT
      a.user_id,
      i.name,
      i.avatar_url,
      count(*)::int as requests,
      coalesce(sum(a.tokens_input + a.tokens_output), 0)::bigint as tokens,
      count(distinct a.session_id)::int as sessions
    FROM audit_log a
    LEFT JOIN identity_mapping i ON i.internal_id = a.user_id
    WHERE a.created_at >= ${from}
    GROUP BY a.user_id, i.name, i.avatar_url
    ORDER BY requests DESC
    LIMIT ${limit}
  `)
  return rows.rows as { user_id: string; name: string; avatar_url: string; requests: number; tokens: number; sessions: number }[]
}

export async function mcpLeaderboard(db: Database, range: string, limit = 10) {
  const from = since(range)
  const rows = await db.execute(sql`
    SELECT
      elem->>'mcp' as mcp,
      count(*)::int as calls,
      count(distinct a.user_id)::int as users
    FROM audit_log a, jsonb_array_elements(COALESCE(a.tools, '[]'::jsonb)) AS elem
    WHERE a.created_at >= ${from} AND elem->>'mcp' IS NOT NULL
    GROUP BY elem->>'mcp'
    ORDER BY calls DESC
    LIMIT ${limit}
  `)
  return rows.rows as { mcp: string; calls: number; users: number }[]
}

export async function modelDistribution(db: Database, range: string) {
  const from = since(range)
  const rows = await db.execute(sql`
    SELECT
      coalesce(model_id, 'unknown') as model,
      count(*)::int as requests,
      coalesce(sum(tokens_input + tokens_output), 0)::bigint as tokens
    FROM audit_log
    WHERE created_at >= ${from}
    GROUP BY model_id
    ORDER BY requests DESC
  `)
  return rows.rows as { model: string; requests: number; tokens: number }[]
}

export async function topTools(db: Database, from: Date, limit = 10) {
  const rows = await db.execute(sql`
    SELECT elem->>'name' as tool, elem->>'mcp' as mcp, count(*)::int as calls
    FROM audit_log, jsonb_array_elements(COALESCE(tools, '[]'::jsonb)) as elem
    WHERE created_at >= ${from}
    GROUP BY elem->>'name', elem->>'mcp'
    ORDER BY count(*) DESC
    LIMIT ${limit}
  `)
  return rows.rows as { tool: string; mcp: string; calls: number }[]
}

export async function mcpUsageTrend(db: Database, name: string, days = 7) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  const rows = await db.execute(sql`
    SELECT date_trunc('day', created_at)::date as day,
      coalesce(sum(tokens_input), 0)::bigint as tokens_in,
      coalesce(sum(tokens_output), 0)::bigint as tokens_out,
      count(*)::int as requests
    FROM audit_log
    WHERE created_at >= ${from}
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(tools, '[]'::jsonb)) AS elem
        WHERE elem->>'mcp' = ${name}
      )
    GROUP BY date_trunc('day', created_at)::date
    ORDER BY day
  `)
  return rows.rows as { day: Date; tokens_in: number; tokens_out: number; requests: number }[]
}

export async function mcpTools(db: Database, name: string) {
  const rows = await db.execute(sql`
    SELECT elem->>'name' AS tool, count(*)::int AS calls
    FROM audit_log, jsonb_array_elements(COALESCE(tools, '[]'::jsonb)) AS elem
    WHERE elem->>'mcp' = ${name}
    GROUP BY elem->>'name'
    ORDER BY count(*) DESC
  `)
  return rows.rows as { tool: string; calls: number }[]
}

export async function recentActivity(db: Database, limit = 10) {
  const rows = await db.execute(sql`
    SELECT
      a.id, a.user_id, a.action, a.model_id,
      a.tokens_input, a.tokens_output, a.created_at,
      i.name as user_name, i.avatar_url
    FROM audit_log a
    LEFT JOIN identity_mapping i ON i.internal_id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `)
  return rows.rows as { id: string; user_id: string; action: string; model_id: string; tokens_input: number; tokens_output: number; created_at: string; user_name: string; avatar_url: string }[]
}
