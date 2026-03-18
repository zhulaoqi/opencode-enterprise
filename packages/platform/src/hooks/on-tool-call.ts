// Called when a tool is invoked — for audit logging and circuit breaker tracking
export async function onToolCall(input: {
  sessionID: string
  userId?: string
  tool: string
  callID: string
  input: unknown
}) {
  // TODO: wire to billing audit + circuit breaker
}
