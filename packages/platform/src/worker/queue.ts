import { Queue } from "bullmq"
import { env } from "@/env"

const url = new URL(env().REDIS_URL)
export const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  password: url.password || undefined,
}

export const chatQueue = new Queue("chat", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
})

export type ChatJob = {
  user_id: string
  session_id: string
  message: string
  source: "feishu" | "dingtalk" | "wecom" | "web"
  model_id?: string
  callback: {
    chat_id?: string
    message_id?: string
    ws_id?: string
  }
}
