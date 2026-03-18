import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { env } from "@/env"

export type AgentResult = {
  text: string
  tokens: { input: number; output: number }
  model: string
}

export async function run(
  history: { role: string; content: { text?: string } }[],
  message: string,
): Promise<AgentResult> {
  const cfg = env()
  const key = cfg.OPENAI_API_KEY
  if (!key) {
    return {
      text: `[未配置 OPENAI_API_KEY] 收到: ${message}`,
      tokens: { input: 0, output: 0 },
      model: "placeholder",
    }
  }

  const openai = createOpenAI({ apiKey: key })
  const model = openai(cfg.LLM_MODEL)

  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: typeof m.content === "object" && m.content?.text ? m.content.text : String(m.content ?? ""),
    })),
    { role: "user" as const, content: message },
  ].filter((m) => m.content)

  const { text, usage } = await generateText({
    model,
    messages,
    system: "You are a helpful AI assistant. Respond concisely in the user's language.",
  })

  const u = usage as { inputTokens?: number; outputTokens?: number } | undefined
  return {
    text,
    tokens: {
      input: u?.inputTokens ?? 0,
      output: u?.outputTokens ?? 0,
    },
    model: cfg.LLM_MODEL,
  }
}
