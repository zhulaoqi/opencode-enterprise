import type { JSX } from "solid-js"
import { Show } from "solid-js"

type Size = "sm" | "md" | "lg"

const maxWidth: Record<Size, string> = {
  sm: "max-w-[480px]",
  md: "max-w-[640px]",
  lg: "max-w-[960px]",
}

type Props = {
  open: boolean
  title?: string
  description?: string
  size?: Size
  onClose: () => void
  children?: JSX.Element
}

export function Modal(props: Props) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") props.onClose()
  }

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
        onKeyDown={handleKeyDown}
      >
        <div
          class="absolute inset-0 bg-[var(--color-bg-overlay)]"
          onClick={props.onClose}
          role="presentation"
        />
        <div
          class={`relative w-full ${maxWidth[props.size ?? "md"]} rounded-[var(--radius-xl)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-xl)] p-6 animate-[modalIn_200ms_ease-out]`}
          role="dialog"
          aria-modal="true"
          tabindex={-1}
        >
          {props.title && (
            <h2 class="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              {props.title}
            </h2>
          )}
          {props.description && (
            <p class="text-sm text-[var(--color-text-muted)] mb-4">{props.description}</p>
          )}
          {props.children}
        </div>
      </div>
    </Show>
  )
}
