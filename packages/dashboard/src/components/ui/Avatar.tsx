import type { JSX } from "solid-js"

type Props = {
  src?: string
  name?: string
  size?: "sm" | "md" | "lg"
  class?: string
}

const sizeClass = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" }

export function Avatar(props: Props) {
  const size = () => props.size ?? "md"
  const initial = () => (props.name ? props.name.slice(0, 1).toUpperCase() : "?")
  return (
    <div
      class={`rounded-full flex items-center justify-center font-medium shrink-0 bg-[var(--color-muted)] text-[var(--color-text-secondary)] ${sizeClass[size()]} ${props.class ?? ""}`}
    >
      {props.src ? (
        <img src={props.src} alt={props.name} class="w-full h-full rounded-full object-cover" />
      ) : (
        initial()
      )}
    </div>
  )
}
