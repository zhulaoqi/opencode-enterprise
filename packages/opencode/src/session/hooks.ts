import type { Tool } from "ai"

export namespace SessionHooks {
  export type BeforePromptInput = {
    sessionID: string
    userId?: string
    system: string[]
  }

  export type AfterToolResolveInput = {
    sessionID: string
    userId?: string
    tools: Record<string, Tool>
  }

  export type OnToolCallInput = {
    sessionID: string
    userId?: string
    tool: string
    callID: string
    input: unknown
  }

  export type OnToolResultInput = {
    sessionID: string
    userId?: string
    tool: string
    callID: string
    output: unknown
    duration: number
  }

  export type OnTokenUsageInput = {
    sessionID: string
    userId?: string
    model: string
    provider: string
    input: number
    output: number
    cached: number
    cost: number
  }

  export type OnMcpToolsChangedInput = {
    sessionID: string
    userId?: string
    added: string[]
    removed: string[]
  }

  type Hooks = {
    beforePrompt: (input: BeforePromptInput) => Promise<BeforePromptInput>
    afterToolResolve: (input: AfterToolResolveInput) => Promise<AfterToolResolveInput>
    onToolCall: (input: OnToolCallInput) => Promise<void>
    onToolResult: (input: OnToolResultInput) => Promise<void>
    onTokenUsage: (input: OnTokenUsageInput) => Promise<void>
    onMcpToolsChanged: (input: OnMcpToolsChangedInput) => Promise<void>
  }

  const registry: Partial<Hooks> = {}

  export function register<K extends keyof Hooks>(name: K, handler: Hooks[K]) {
    registry[name] = handler
  }

  export function clear() {
    for (const k of Object.keys(registry)) delete registry[k as keyof Hooks]
  }

  export async function runBeforePrompt(input: BeforePromptInput): Promise<BeforePromptInput> {
    if (!registry.beforePrompt) return input
    return registry.beforePrompt(input)
  }

  export async function runAfterToolResolve(input: AfterToolResolveInput): Promise<AfterToolResolveInput> {
    if (!registry.afterToolResolve) return input
    return registry.afterToolResolve(input)
  }

  export async function runOnToolCall(input: OnToolCallInput): Promise<void> {
    if (!registry.onToolCall) return
    return registry.onToolCall(input)
  }

  export async function runOnToolResult(input: OnToolResultInput): Promise<void> {
    if (!registry.onToolResult) return
    return registry.onToolResult(input)
  }

  export async function runOnTokenUsage(input: OnTokenUsageInput): Promise<void> {
    if (!registry.onTokenUsage) return
    return registry.onTokenUsage(input)
  }

  export async function runOnMcpToolsChanged(input: OnMcpToolsChangedInput): Promise<void> {
    if (!registry.onMcpToolsChanged) return
    return registry.onMcpToolsChanged(input)
  }
}
