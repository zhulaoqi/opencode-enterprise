import type { JSX } from "solid-js"

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent"
type Size = "sm" | "md" | "lg"

const variantClass: Record<Variant, string> = {
  primary: "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)]",
  secondary: "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-secondary-hover)] hover:text-[var(--color-on-secondary)]",
  ghost: "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]",
  danger: "bg-[var(--color-error)] text-white hover:opacity-90 active:opacity-80",
  accent: "bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]",
}

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-4 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-base",
}

type Props = {
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  type?: "button" | "submit" | "reset"
  class?: string
  children?: JSX.Element
  onClick?: () => void
}

export function Button(props: Props) {
  const variant = () => props.variant ?? "primary"
  const size = () => props.size ?? "md"
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled || props.loading}
      class={`inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] transition-all duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variantClass[variant()]} ${sizeClass[size()]} ${props.class ?? ""}`}
      onClick={props.onClick}
    >
      {props.loading ? (
        <span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        props.children
      )}
    </button>
  )
}
