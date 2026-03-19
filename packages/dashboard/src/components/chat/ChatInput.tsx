import { createSignal, createResource } from "solid-js"
import { Send, Square } from "lucide-solid"
import { sendMessage, cancelStream, isStreaming } from "../../stores/chat"
import { api } from "../../lib/api"
import { Button } from "../ui/Button"
import { ProgressBar } from "../ui/ProgressBar"

export function ChatInput() {
  const [text, setText] = createSignal("")
  const [quota] = createResource(() => api.get<{ tokens_used: number; max_tokens: number; pct: number }>("/billing/me"))

  const handleSubmit = () => {
    const t = text().trim()
    if (!t) return
    sendMessage(t)
    setText("")
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div class="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div class="flex flex-col gap-2 max-w-3xl mx-auto">
        {quota() && (
          <div class="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>配额</span>
            <ProgressBar value={quota()!.tokens_used} max={quota()!.max_tokens} class="flex-1 max-w-24" />
            <span class="tabular-nums">{Math.round(quota()!.pct)}%</span>
          </div>
        )}
        <div class="flex gap-2 items-end">
          <textarea
          class="flex-1 min-h-[44px] max-h-32 px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-border-focus)]"
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          rows={1}
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming()}
        />
          <Button
            variant="primary"
            class="shrink-0 h-11 px-4"
            onClick={() => (isStreaming() ? cancelStream() : handleSubmit())}
            disabled={!text().trim() && !isStreaming()}
          >
            {isStreaming() ? <Square size={18} /> : <Send size={18} />}
          </Button>
        </div>
      </div>
    </div>
  )
}
