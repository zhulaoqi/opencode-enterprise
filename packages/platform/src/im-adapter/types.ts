export type ImSource = "feishu" | "dingtalk" | "wecom" | "web"

export type ImMessage = {
  source: ImSource
  user_external_id: string
  chat_id: string
  chat_type: "private" | "group"
  content: string
  mentions?: string[]
  message_id?: string
  metadata: Record<string, unknown>
}

export type ImReply = {
  type: "text" | "card" | "rich_text"
  content: string
}

export type ImCard = {
  title: string
  elements: ImCardElement[]
}

export type ImCardElement =
  | { tag: "markdown"; content: string }
  | { tag: "action"; actions: ImCardAction[] }
  | { tag: "hr" }
  | { tag: "note"; elements: { tag: "plain_text"; content: string }[] }

export type ImCardAction = {
  tag: "button"
  text: { tag: "plain_text"; content: string }
  type: "primary" | "danger" | "default"
  value?: Record<string, string>
  url?: string
}
