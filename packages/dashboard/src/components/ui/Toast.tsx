import { For } from "solid-js"
import { toasts, dismiss } from "../../stores/notification"
import { X } from "lucide-solid"

const typeIcon: Record<string, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
}

const typeBg: Record<string, string> = {
  success: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  error: "bg-[var(--color-error-light)] text-[var(--color-error)]",
  warning: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  info: "bg-[var(--color-info-light)] text-[var(--color-info)]",
}

export function Toast() {
  return (
    <div
      class="fixed top-4 right-4 z-[var(--z-toast)] flex flex-col gap-2 max-w-sm"
      aria-live="polite"
    >
      <For each={toasts().slice(-3)}>
        {(t) => (
          <div
            class={`flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] ${typeBg[t.type]} animate-[slideInRight_200ms_ease-out]`}
          >
            <span class="text-sm font-medium">{typeIcon[t.type] ?? ""} {t.message}</span>
            <button
              class="ml-auto p-1 rounded hover:bg-black/10"
              onClick={() => dismiss(t.id)}
              aria-label="关闭"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
