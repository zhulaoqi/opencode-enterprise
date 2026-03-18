import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core"
import { identity_mapping } from "../auth/identity.sql"

export const enterprise_session = pgTable(
  "enterprise_session",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => identity_mapping.internal_id),
    project_id: varchar({ length: 256 }),
    title: varchar({ length: 512 }),
    directory: text(),
    status: varchar({ length: 16 }).notNull().default("active"),
    mcp_snapshot: jsonb(),
    system_prompt: text(),
    metadata: jsonb().default({}),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_session_user").on(t.user_id, t.created_at)],
)
