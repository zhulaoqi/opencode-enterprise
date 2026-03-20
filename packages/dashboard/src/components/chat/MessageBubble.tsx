import { marked } from "marked"
import { Copy, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-solid"
import type { Message } from "../../stores/chat"

type Props = {
  msg: Message
}

export function MessageBubble(props: Props) {
  const m = () => props.msg
  const isUser = () => m().role === "user"
  const text = () => m().text || ""
  const html = () => marked.parse(text()) as string

  return (
    <div class={`group flex ${isUser() ? "justify-end" : "justify-start"} mb-4`}>
      <div
        class={`${isUser() ? "max-w-[80%]" : "max-w-[85%]"} rounded-[var(--radius-lg)] px-4 py-3 ${
          isUser()
            ? "bg-[var(--color-primary-light)] text-[var(--color-text-primary)]"
            : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
        }`}
      >
        {isUser()
          ? <p class="text-sm whitespace-pre-wrap break-words">{text()}</p>
          : <div class="markdown-body text-sm break-words" innerHTML={html()} />
        }
        <p class="text-xs text-[var(--color-text-muted)] mt-2">
          {m().time ? new Date(m().time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : ""}
        </p>
        {!isUser() && (
          <div class="hidden group-hover:flex flex-row gap-1 mt-2 -mb-1">
            <button
              class="p-1.5 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] cursor-pointer"
              onClick={() => navigator.clipboard.writeText(text() ?? "")}
              aria-label="复制"
            >
              <Copy size={14} />
            </button>
            <button class="p-1.5 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] cursor-pointer" aria-label="赞">
              <ThumbsUp size={14} />
            </button>
            <button class="p-1.5 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] cursor-pointer" aria-label="踩">
              <ThumbsDown size={14} />
            </button>
            <button class="p-1.5 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] cursor-pointer" aria-label="重新生成">
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
