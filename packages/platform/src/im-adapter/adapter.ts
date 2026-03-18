import type { ImMessage, ImReply, ImCard } from "./types"

export interface ImAdapter {
  readonly source: string
  verify(req: Request, body: unknown): Promise<boolean>
  parse(body: unknown): Promise<ImMessage | null>
  reply(chatId: string, content: ImReply): Promise<void>
  card(chatId: string, card: ImCard): Promise<void>
}
