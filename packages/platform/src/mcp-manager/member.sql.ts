import { pgTable, uuid, varchar, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { mcp_registry } from "./registry.sql"
import { identity_mapping } from "../auth/identity.sql"

export const mcp_member = pgTable(
  "mcp_member",
  {
    id: uuid().primaryKey().defaultRandom(),
    mcp_id: uuid().notNull().references(() => mcp_registry.id, { onDelete: "cascade" }),
    user_id: uuid().notNull().references(() => identity_mapping.internal_id),
    role: varchar({ length: 16 }).notNull().default("user"),
    granted_by: uuid(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idx_mcp_member_unique").on(t.mcp_id, t.user_id)],
)

export const mcp_application = pgTable("mcp_application", {
  id: uuid().primaryKey().defaultRandom(),
  mcp_id: uuid().notNull().references(() => mcp_registry.id, { onDelete: "cascade" }),
  user_id: uuid().notNull().references(() => identity_mapping.internal_id),
  status: varchar({ length: 16 }).notNull().default("pending"),
  reason: text(),
  reviewed_by: uuid(),
  reviewed_at: timestamp({ withTimezone: true }),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
