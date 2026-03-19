import { createSignal, createResource } from "solid-js"
import { Send, Square, ChevronDown } from "lucide-solid"
import { sendMessage, cancelStream, isStreaming } from "../../stores/chat"
import { api } from "../../lib/api"
import { Button } from "../ui/Button"
import { ProgressBar } from "../ui/ProgressBar"

const models = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "claude-sonnet-4-20250514", label: "Claude 3.5 Sonnet" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
] as const

const [model, setModel] = createSignal("gpt-4o")

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
        <div class="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          {quota() && (
            <>
              <span>配额</span>
              <ProgressBar value={quota()!.tokens_used} max={quota()!.max_tokens} class="flex-1 max-w-24" />
              <span class="tabular-nums">{Math.round(quota()!.pct)}%</span>
            </>
          )}
          <div class="ml-auto flex items-center gap-1">
            <div class="relative flex items-center">
              <select
                class="h-7 px-2 pr-6 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] appearance-none cursor-pointer"
                value={model()}
                onChange={(e) => setModel(e.currentTarget.value)}
              >
                {models.map((m) => (
                  <option value={m.id}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={12} class="absolute right-1.5 pointer-events-none text-[var(--color-text-muted)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
