import * as circuitBreaker from "@/billing/circuit-breaker"

export async function onToolCall(input: {
  sessionID: string
  userId?: string
  tool: string
  callID: string
  input: unknown
}) {
  const mcpName = input.tool.split("_")[0] ?? "unknown"
  await circuitBreaker.recordCall(mcpName)
}
