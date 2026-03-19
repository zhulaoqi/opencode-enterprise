import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core"
import { identity_mapping } from "../auth/identity.sql"

export const mcp_group = pgTable("mcp_group", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 128 }).notNull(),
  description: text(),
  type: varchar({ length: 16 }).notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const mcp_registry = pgTable(
  "mcp_registry",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({ length: 128 }).notNull().unique(),
    display_name: varchar({ length: 256 }).notNull(),
    description: text(),
    type: varchar({ length: 16 }).notNull(),
    config: jsonb().notNull(),
    visibility: varchar({ length: 16 }).notNull().default("PRIVATE"),
    owner_id: uuid().notNull().references(() => identity_mapping.internal_id),
    group_id: uuid().references(() => mcp_group.id),
    tags: jsonb().$type<string[]>().default([]),
    health_status: varchar({ length: 16 }).notNull().default("unknown"),
    last_health_at: timestamp({ withTimezone: true }),
    enabled: boolean().notNull().default(true),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_mcp_visibility").on(t.visibility),
    index("idx_mcp_owner").on(t.owner_id),
  ],
)

