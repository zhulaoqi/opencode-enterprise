import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const identity_mapping = pgTable("identity_mapping", {
  id: uuid().primaryKey().defaultRandom(),
  internal_id: uuid().notNull().unique().defaultRandom(),
  employee_id: varchar({ length: 64 }),
  feishu_user_id: varchar({ length: 128 }),
  feishu_union_id: varchar({ length: 128 }),
  dingtalk_id: varchar({ length: 128 }),
  wecom_id: varchar({ length: 128 }),
  name: varchar({ length: 256 }).notNull(),
  email: varchar({ length: 256 }),
  avatar_url: text(),
  department_ids: jsonb().$type<string[]>().notNull().default([]),
  job_level: varchar({ length: 64 }),
  status: varchar({ length: 32 }).notNull().default("active"),
  last_sync_at: timestamp({ withTimezone: true }),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("idx_feishu").on(t.feishu_user_id),
  uniqueIndex("idx_union").on(t.feishu_union_id),
])
