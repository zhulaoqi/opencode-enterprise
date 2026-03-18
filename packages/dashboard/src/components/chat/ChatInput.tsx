import { createSignal } from "solid-js"
import { Send, Square } from "lucide-solid"
import { sendMessage, cancelStream, isStreaming } from "../../stores/chat"
import { Button } from "../ui/Button"

export function ChatInput() {
  const [text, setText] = createSignal("")

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
      <div class="flex gap-2 items-end max-w-3xl mx-auto">
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
  )
}
