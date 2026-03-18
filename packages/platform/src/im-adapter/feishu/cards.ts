export function processingCard(text = "收到，正在处理中...") {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: "AI 助手" }, template: "blue" },
    elements: [{ tag: "markdown", content: `⏳ ${text}` }],
  }
}

export function resultCard(text: string, sessionId?: string, detailUrl?: string) {
  const elements: unknown[] = [{ tag: "markdown", content: text.slice(0, 2000) }]
  if (text.length > 2000 || detailUrl) {
    elements.push({ tag: "hr" })
    elements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          text: { tag: "plain_text", content: "查看完整结果" },
          type: "primary",
          url: detailUrl ?? `${process.env.DASHBOARD_URL ?? ""}/chat/${sessionId}`,
        },
      ],
    })
  }
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: "AI 助手" }, template: "green" },
    elements,
  }
}

export function errorCard(message: string) {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: "处理失败" }, template: "red" },
    elements: [
      { tag: "markdown", content: `❌ ${message}` },
      { tag: "note", elements: [{ tag: "plain_text", content: "如需帮助，请联系管理员" }] },
    ],
  }
}

export function approvalCard(opts: { title: string; description: string; sessionId: string }) {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: "需要审批" }, template: "orange" },
    elements: [
      { tag: "markdown", content: `**${opts.title}**\n\n${opts.description}` },
      { tag: "hr" },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "拒绝" },
            type: "danger",
            value: JSON.stringify({ action: "reject", session: opts.sessionId }),
          },
          {
            tag: "button",
            text: { tag: "plain_text", content: "批准" },
            type: "primary",
            value: JSON.stringify({ action: "approve", session: opts.sessionId }),
          },
        ],
      },
    ],
  }
}
