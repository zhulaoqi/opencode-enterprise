// Called after each LLM step with token usage data
export async function onTokenUsage(input: {
  sessionID: string
  userId?: string
  model: string
  provider: string
  input: number
  output: number
  cached: number
  cost: number
}) {
  // TODO: wire to quota check + cost recording + audit log
}
