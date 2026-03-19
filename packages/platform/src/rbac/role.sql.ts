import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp } from "drizzle-orm/pg-core"
import { identity_mapping } from "../auth/identity.sql"

export type RolePermission = {
  type: "feature"
  pattern: string
  action: "allow" | "deny"
}

export const role = pgTable("role", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 64 }).notNull().unique(),
  display_name: varchar({ length: 128 }).notNull(),
  description: text(),
  permissions: jsonb().$type<RolePermission[]>().notNull().default([]),
  is_system: boolean().notNull().default(false),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const user_role = pgTable("user_role", {
  id: uuid().primaryKey().defaultRandom(),
  user_id: uuid().notNull().references(() => identity_mapping.internal_id),
  role_id: uuid().notNull().references(() => role.id),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

