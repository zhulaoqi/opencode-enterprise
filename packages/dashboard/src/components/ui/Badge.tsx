import type { JSX } from "solid-js"

type Variant = "success" | "error" | "warning" | "info" | "default"

const variantClass: Record<Variant, string> = {
  success: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  error: "bg-[var(--color-error-light)] text-[var(--color-error)]",
  warning: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  info: "bg-[var(--color-info-light)] text-[var(--color-info)]",
  default: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
}

type Props = {
  variant?: Variant
  class?: string
  children?: JSX.Element
}

export function Badge(props: Props) {
  const v = () => props.variant ?? "default"
  return (
    <span
      class={`inline-flex items-center h-[22px] px-2 rounded-[var(--radius-sm)] text-xs font-medium ${variantClass[v()]} ${props.class ?? ""}`}
    >
      {props.children}
    </span>
  )
}
