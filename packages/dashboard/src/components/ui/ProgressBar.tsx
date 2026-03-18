type Props = {
  value: number
  max: number
  class?: string
}

export function ProgressBar(props: Props) {
  const pct = () => (props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0)
  const variant = () => {
    const p = pct()
    if (p >= 95) return "error"
    if (p >= 80) return "warning"
    if (p >= 60) return "info"
    return "success"
  }
  const bg = () => {
    const v = variant()
    if (v === "error") return "bg-[var(--color-error)]"
    if (v === "warning") return "bg-[var(--color-warning)]"
    if (v === "info") return "bg-[var(--color-info)]"
    return "bg-[var(--color-success)]"
  }
  return (
    <div class={`h-2 rounded-full bg-[var(--color-muted)] overflow-hidden ${props.class ?? ""}`}>
      <div
        class={`h-full transition-all duration-300 ${bg()}`}
        style={{ width: `${pct()}%` }}
      />
    </div>
  )
}
