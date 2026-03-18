import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { env } from "@/env"
import * as schema from "./schema"

let pool: pg.Pool | undefined
let db: ReturnType<typeof drizzle> | undefined

export function database() {
  if (db) return db
  pool = new pg.Pool({
    connectionString: env().DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  db = drizzle({ client: pool, schema })
  return db
}

export async function close() {
  if (pool) await pool.end()
  pool = undefined
  db = undefined
}

export type Database = ReturnType<typeof database>
