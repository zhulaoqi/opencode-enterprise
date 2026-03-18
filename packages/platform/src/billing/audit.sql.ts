import { pgTable, uuid, varchar, jsonb, integer, numeric, timestamp, index } from "drizzle-orm/pg-core"

export const audit_log = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid().notNull(),
    session_id: uuid(),
    action: varchar({ length: 64 }).notNull(),
    model_id: varchar({ length: 128 }),
    provider_id: varchar({ length: 64 }),
    tokens_input: integer().default(0),
    tokens_output: integer().default(0),
    tokens_cached: integer().default(0),
    cost_usd: numeric({ precision: 12, scale: 8 }).default("0"),
    tools: jsonb()
      .$type<{ name: string; mcp?: string; status: string; duration_ms: number }[]>()
      .default([]),
    metadata: jsonb().default({}),
    duration_ms: integer(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_user").on(t.user_id, t.created_at),
    index("idx_audit_action").on(t.action, t.created_at),
  ],
)
