import { SessionHooks } from "opencode/session/hooks"
import { beforePrompt } from "./before-prompt"
import { afterToolResolve } from "./after-tool-resolve"
import { onToolCall } from "./on-tool-call"
import { onToolResult } from "./on-tool-result"
import { onTokenUsage } from "./on-token-usage"
import { onMcpToolsChanged } from "./on-mcp-tools-changed"

export function register() {
  SessionHooks.register("beforePrompt", beforePrompt)
  SessionHooks.register("afterToolResolve", afterToolResolve)
  SessionHooks.register("onToolCall", onToolCall)
  SessionHooks.register("onToolResult", onToolResult)
  SessionHooks.register("onTokenUsage", onTokenUsage)
  SessionHooks.register("onMcpToolsChanged", onMcpToolsChanged)
  console.log("[platform] hooks registered with OpenCode SessionHooks")
}
