import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { env } from "@/env"
import { database } from "@/db"
import * as model from "@/model/model"

export type AgentResult = {
  text: string
  tokens: { input: number; output: number }
  model: string
}

function headers(prov: string): Record<string, string> {
  if (prov === "openrouter") {
    return {
      "HTTP-Referer": "https://opencode.enterprise",
      "X-Title": "OpenCode Enterprise",
    }
  }
  return {}
}

export async function run(
  history: { role: string; content: { text?: string } }[],
  message: string,
  mid?: string,
): Promise<AgentResult> {
  const cfg = env()

  let key = cfg.OPENAI_API_KEY
  let base = cfg.OPENAI_BASE_URL
  let name = cfg.LLM_MODEL
  let prov = "openrouter"

  if (mid && mid !== "default") {
    const db = database()
    const row = await model.byId(db, mid)
    if (row) {
      key = row.api_key
      base = row.base_url
      name = row.model_id
      prov = row.provider ?? "custom"
    }
  }

  if (!key) {
    return {
      text: `[未配置 API Key] 收到: ${message}`,
      tokens: { input: 0, output: 0 },
      model: "placeholder",
    }
  }

  if (base && !base.endsWith("/")) base += "/"

  console.log(`[agent] calling provider=${prov} model=${name} base=${base}`)

  const provider = createOpenAI({
    apiKey: key,
    baseURL: base,
    name: prov,
    headers: headers(prov),
  })
  const llm = provider.chat(name)

  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: typeof m.content === "object" && m.content?.text ? m.content.text : String(m.content ?? ""),
    })),
    { role: "user" as const, content: message },
  ].filter((m) => m.content)

  const { text, usage } = await generateText({
    model: llm,
    messages,
    system: "You are a helpful AI assistant. Respond concisely in the user's language.",
  })

  const u = usage as { inputTokens?: number; outputTokens?: number } | undefined
  console.log(`[agent] done model=${name} input=${u?.inputTokens ?? 0} output=${u?.outputTokens ?? 0}`)
  return {
    text,
    tokens: {
      input: u?.inputTokens ?? 0,
      output: u?.outputTokens ?? 0,
    },
    model: name,
  }
}
