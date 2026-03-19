import { emitMcpChange } from "@/server/ws"

export async function onMcpToolsChanged(input: {
  sessionID: string
  userId?: string
  added: string[]
  removed: string[]
}) {
  if (input.userId) {
    emitMcpChange(input.userId, input.added, input.removed)
  }
}
