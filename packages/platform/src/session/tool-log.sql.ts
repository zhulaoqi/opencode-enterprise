import { pgTable, uuid, varchar, jsonb, integer, timestamp, index } from "drizzle-orm/pg-core"

export const enterprise_tool_log = pgTable(
  "enterprise_tool_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    session_id: uuid().notNull(),
    message_id: uuid().notNull(),
    tool_name: varchar({ length: 256 }).notNull(),
    mcp_name: varchar({ length: 128 }),
    input: jsonb(),
    output: jsonb(),
    status: varchar({ length: 16 }).notNull(),
    duration_ms: integer(),
    user_id: uuid().notNull(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_tool_log_session").on(t.session_id, t.created_at),
    index("idx_tool_log_user").on(t.user_id, t.created_at),
  ],
)
