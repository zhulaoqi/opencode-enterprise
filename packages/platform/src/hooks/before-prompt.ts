// Injected before system prompt is sent to LLM
// Will add enterprise context (user role, department MCP list, quota info)
export async function beforePrompt(input: {
  sessionID: string
  userId?: string
  system: string[]
}) {
  // TODO: wire to RBAC + MCP resolver for dynamic prompt injection
  return input
}
