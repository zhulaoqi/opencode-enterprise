import { pgTable, uuid, varchar, jsonb, integer, numeric, timestamp, index } from "drizzle-orm/pg-core"
import { enterprise_session } from "./session.sql"

export const enterprise_message = pgTable(
  "enterprise_message",
  {
    id: uuid().primaryKey().defaultRandom(),
    session_id: uuid()
      .notNull()
      .references(() => enterprise_session.id),
    role: varchar({ length: 16 }).notNull(),
    content: jsonb().notNull(),
    tokens_input: integer().notNull().default(0),
    tokens_output: integer().notNull().default(0),
    tokens_cached: integer().notNull().default(0),
    cost_usd: numeric({ precision: 12, scale: 8 }).notNull().default("0"),
    model_id: varchar({ length: 128 }),
    provider_id: varchar({ length: 64 }),
    duration_ms: integer(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_message_session").on(t.session_id, t.created_at)],
)
