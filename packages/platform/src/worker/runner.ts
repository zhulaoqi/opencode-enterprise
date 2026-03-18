import { start } from "./consumer"
import { database } from "@/db"
import * as audit from "@/billing/audit"
import * as sync from "@/billing/sync"

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? "4")

console.log(`[worker] starting with concurrency=${concurrency}`)

database()
audit.startFlush()
sync.start()

const worker = start(concurrency)

console.log(`[worker] ready, waiting for jobs...`)

process.on("SIGTERM", async () => {
  console.log("[worker] shutting down...")
  await worker.close()
  process.exit(0)
})
