import { pgTable, uuid, varchar, text, boolean, integer, timestamp } from "drizzle-orm/pg-core"

export const llm_model = pgTable("llm_model", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 64 }).notNull(),
  model_id: varchar({ length: 128 }).notNull(),
  provider: varchar({ length: 32 }).notNull().default("openai"),
  base_url: varchar({ length: 512 }).notNull(),
  api_key: text().notNull(),
  role: varchar({ length: 16 }).notNull().default("primary"),
  enabled: boolean().notNull().default(true),
  sort_order: integer().notNull().default(0),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
