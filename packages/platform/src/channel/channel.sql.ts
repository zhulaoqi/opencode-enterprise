import { pgTable, uuid, varchar, boolean, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const channel_config = pgTable(
  "channel_config",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: varchar({ length: 16 }).notNull(),
    enabled: boolean().notNull().default(false),
    config: jsonb().notNull().default({}),
    settings: jsonb().notNull().default({}),
    last_event: timestamp({ withTimezone: true }),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idx_channel_type").on(t.type)],
)
