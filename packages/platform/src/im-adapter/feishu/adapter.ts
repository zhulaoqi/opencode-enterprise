import type { ImAdapter } from "../adapter"
import type { ImMessage, ImReply, ImCard } from "../types"
import * as webhook from "./webhook"
import * as client from "./client"
import { env } from "@/env"
import { resolved } from "@/server/routes/channel"

export class FeishuAdapter implements ImAdapter {
  readonly source = "feishu"

  async verify(_req: Request, body: unknown): Promise<boolean> {
    const ch = await resolved("feishu")
    const tk = (ch?.config as Record<string, string>)?.verification_token ?? env().FEISHU_VERIFICATION_TOKEN
    if (!tk) return true
    return webhook.verifySignature(body, tk)
  }

  async parse(body: unknown): Promise<ImMessage | null> {
    return webhook.parse(body)
  }

  async reply(chatId: string, content: ImReply): Promise<void> {
    if (content.type === "text") {
      await client.sendText(chatId, content.content)
    } else if (content.type === "card") {
      await client.sendCard(chatId, JSON.parse(content.content))
    }
  }

  async card(chatId: string, card: ImCard): Promise<void> {
    const feishuCard = {
      config: { wide_screen_mode: true },
      header: { title: { tag: "plain_text", content: card.title }, template: "blue" },
      elements: card.elements.map((el) => {
        if (el.tag === "markdown") return { tag: "markdown", content: el.content }
        if (el.tag === "hr") return { tag: "hr" }
        return el
      }),
    }
    await client.sendCard(chatId, feishuCard)
  }
}
