import { redis } from "@/redis"

const CHANNEL = "platform:chat:done"

export type DonePayload = {
  user_id: string
  session_id: string
  type: "done"
  text: string
}

export async function publishDone(payload: DonePayload) {
  await redis().publish(CHANNEL, JSON.stringify(payload))
}
