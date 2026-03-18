import type { Message } from "../../stores/chat"

type Props = {
  msg: Message
}

export function MessageBubble(props: Props) {
  const m = () => props.msg
  const isUser = () => m().role === "user"
  const text = () => (typeof m().content === "object" && m().content?.text ? m().content.text : String(m().content ?? ""))

  return (
    <div class={`flex ${isUser() ? "justify-end" : "justify-start"} mb-4`}>
      <div
        class={`max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 ${
          isUser()
            ? "bg-[var(--color-primary-light)] text-[var(--color-text-primary)]"
            : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
        }`}
      >
        <p class="text-sm whitespace-pre-wrap break-words">{text()}</p>
        <p class="text-xs text-[var(--color-text-muted)] mt-2">
          {new Date(m().created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}
