import type { JSX } from "solid-js"

type Props = {
  width?: string | number
  height?: string | number
  rounded?: "sm" | "md" | "lg" | "full"
  class?: string
}

const roundedClass = {
  sm: "rounded-[var(--radius-sm)]",
  md: "rounded-[var(--radius-md)]",
  lg: "rounded-[var(--radius-lg)]",
  full: "rounded-full",
}

export function Skeleton(props: Props) {
  const w = () => (typeof props.width === "number" ? `${props.width}px` : props.width ?? "100%")
  const h = () => (typeof props.height === "number" ? `${props.height}px` : props.height ?? "20px")
  return (
    <div
      class={`animate-pulse bg-[var(--color-muted)] ${roundedClass[props.rounded ?? "md"]} ${props.class ?? ""}`}
      style={{ width: w(), height: h() }}
    />
  )
}
