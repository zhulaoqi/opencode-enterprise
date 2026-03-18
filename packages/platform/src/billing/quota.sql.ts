import { pgTable, uuid, varchar, bigint, integer, numeric, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const quota_config = pgTable(
  "quota_config",
  {
    id: uuid().primaryKey().defaultRandom(),
    scope_type: varchar({ length: 16 }).notNull(),
    scope_id: varchar({ length: 128 }).notNull(),
    period: varchar({ length: 16 }).notNull(),
    max_tokens: bigint({ mode: "number" }).notNull(),
    max_requests: integer(),
    max_cost_usd: numeric({ precision: 12, scale: 4 }),
    enabled: boolean().notNull().default(true),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idx_quota_config_scope").on(t.scope_type, t.scope_id, t.period)],
)

export const quota_usage = pgTable(
  "quota_usage",
  {
    id: uuid().primaryKey().defaultRandom(),
    scope_type: varchar({ length: 16 }).notNull(),
    scope_id: varchar({ length: 128 }).notNull(),
    period_key: varchar({ length: 16 }).notNull(),
    tokens_used: bigint({ mode: "number" }).notNull().default(0),
    requests_count: integer().notNull().default(0),
    cost_usd: numeric({ precision: 12, scale: 4 }).notNull().default("0"),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idx_quota_usage_unique").on(t.scope_type, t.scope_id, t.period_key)],
)
