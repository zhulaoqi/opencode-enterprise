import { subscriber } from "@/redis"
import * as ws from "./ws"

const CHANNEL = "platform:chat:done"

export function start() {
  const sub = subscriber()
  sub.subscribe(CHANNEL)
  sub.on("message", (channel, message) => {
    if (channel !== CHANNEL) return
    try {
      const payload = JSON.parse(message) as { user_id: string; session_id: string; type: string; text: string }
      if (payload.user_id && payload.type === "done") {
        ws.broadcast(payload.user_id, payload)
      }
    } catch {
      // ignore parse errors
    }
  })
}
