import type { JSX } from "solid-js"

type Props = {
  label?: string
  error?: string
  helper?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  type?: string
  class?: string
  onInput?: (v: string) => void
  onBlur?: () => void
}

export function Input(props: Props) {
  const msg = () => props.error ?? props.helper
  const isError = () => !!props.error
  return (
    <div class={props.class}>
      {props.label && (
        <label class="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">
          {props.label}
        </label>
      )}
      <input
        type={props.type ?? "text"}
        value={props.value ?? ""}
        placeholder={props.placeholder}
        disabled={props.disabled}
        class={`w-full h-10 px-3 text-base rounded-[var(--radius-md)] border bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] disabled:bg-[var(--color-muted)] disabled:opacity-60 ${isError() ? "border-[var(--color-error)]" : "border-[var(--color-border)]"}`}
        onInput={(e) => props.onInput?.(e.currentTarget.value)}
        onBlur={props.onBlur}
      />
      {msg() && (
        <p class={`mt-1 text-xs ${isError() ? "text-[var(--color-error)]" : "text-[var(--color-text-muted)]"}`}>
          {msg()}
        </p>
      )}
    </div>
  )
}
