import type { JSX } from "solid-js"

type Props = {
  clickable?: boolean
  class?: string
  children?: JSX.Element
  onClick?: () => void
}

export function Card(props: Props) {
  return (
    <div
      class={`rounded-[var(--radius-lg)] p-4 bg-[var(--color-card)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-150 ${props.clickable ? "cursor-pointer active:scale-[0.99]" : ""} ${props.class ?? ""}`}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  )
}
