import { Worker, type Job } from "bullmq"
import { eq } from "drizzle-orm"
import { connection, type ChatJob } from "./queue"
import { env } from "@/env"
import { database } from "@/db"
import * as session from "@/session"
import * as identity from "@/auth/identity"
import * as feishuClient from "@/im-adapter/feishu/client"
import * as cards from "@/im-adapter/feishu/cards"
import * as notify from "./notify"
import * as agent from "./agent"

export function start(concurrency = 4) {
  const worker = new Worker<ChatJob>(
    "chat",
    process,
    {
      connection,
      concurrency,
      limiter: { max: 100, duration: 60_000 },
    },
  )

  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} completed`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message)
    handleFailure(job?.data, err.message)
  })

  return worker
}

async function process(job: Job<ChatJob>) {
  const data = job.data
  const db = database()

  const user = await identity.byInternalId(db, data.user_id)
  if (!user) throw new Error("User not found")

  if (data.source === "feishu" && data.callback.chat_id) {
    await feishuClient.sendCard(data.callback.chat_id, cards.processingCard())
  }

  let sess: session.Session | null = null
  if (data.session_id) {
    const [row] = await db
      .select()
      .from(session.enterprise_session)
      .where(eq(session.enterprise_session.id, data.session_id))
    sess = row ?? null
  }

  if (!sess) {
    sess = await session.create(db, {
      user_id: data.user_id,
      title: data.message.slice(0, 50),
    })
  }

  await session.addMessage(db, {
    session_id: sess.id,
    role: "user",
    content: { text: data.message },
  })

  const history = await session.messages(db, sess.id)

  const historyForAgent = history.slice(0, -1).map((m) => {
    const c = m.content
    const text = typeof c === "object" && c && "text" in c ? String((c as { text?: unknown }).text ?? "") : String(c ?? "")
    return { role: m.role, content: { text } }
  })
  const result = await agent.run(historyForAgent, data.message)

  await session.addMessage(db, {
    session_id: sess.id,
    role: "assistant",
    content: { text: result.text },
    tokens_input: result.tokens.input,
    tokens_output: result.tokens.output,
    model_id: result.model,
  })

  await pushResult(data, result.text, sess.id)

  if (data.source === "web" && data.callback.ws_id) {
    await notify.publishDone({
      user_id: data.user_id,
      session_id: sess.id,
      type: "done",
      text: result.text,
    })
  }
}

async function pushResult(data: ChatJob, text: string, sessionId: string) {
  if (data.source === "feishu" && data.callback.chat_id) {
    if (text.length <= 2000) {
      await feishuClient.sendText(data.callback.chat_id, text)
    } else {
      const card = cards.resultCard(text, sessionId)
      await feishuClient.sendCard(data.callback.chat_id, card)
    }
  }
}

async function handleFailure(data: ChatJob | undefined, error: string) {
  if (!data) return
  if (data.source === "feishu" && data.callback.chat_id) {
    await feishuClient.sendCard(data.callback.chat_id, cards.errorCard(error))
  }
}
