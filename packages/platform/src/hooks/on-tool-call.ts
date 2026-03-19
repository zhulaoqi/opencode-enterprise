import * as circuitBreaker from "@/billing/circuit-breaker"

export async function onToolCall(input: {
  sessionID: string
  userId?: string
  tool: string
  callID: string
  input: unknown
}) {
  const mcp = input.tool.split("_")[0] ?? "unknown"
  const check = await circuitBreaker.allowed(mcp)
  if (!check.ok) throw new Error(check.message ?? `${mcp} 当前不可用`)
  await circuitBreaker.recordCall(mcp)
}
