import * as audit from "@/billing/audit"
import * as circuitBreaker from "@/billing/circuit-breaker"
import { userId as processUserId } from "./context"

export async function onToolResult(input: {
  sessionID: string
  userId?: string
  tool: string
  callID: string
  output: unknown
  duration: number
}) {
  const mcpName = input.tool.split("_")[0] ?? "unknown"
  await circuitBreaker.success(mcpName)

  const uid = input.userId ?? processUserId()
  if (uid) {
    audit.log({
      user_id: uid,
      session_id: input.sessionID,
      action: "tool_result",
      tools: [
        {
          name: input.tool,
          mcp: mcpName,
          status: "success",
          duration_ms: input.duration,
        },
      ],
    })
  }
}
