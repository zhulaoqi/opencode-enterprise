import { emitMcpChange } from "@/server/ws"
import { userId as processUserId } from "./context"

export async function onMcpToolsChanged(input: {
  sessionID: string
  userId?: string
  added: string[]
  removed: string[]
}) {
  const uid = input.userId ?? processUserId()
  if (uid) {
    emitMcpChange(uid, input.added, input.removed)
  }
}
