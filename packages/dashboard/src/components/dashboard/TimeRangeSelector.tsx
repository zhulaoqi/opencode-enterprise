type Range = "day" | "week" | "month" | "quarter"

type Props = {
  value: Range
  onChange: (r: Range) => void
}

const opts: { id: Range; label: string }[] = [
  { id: "day", label: "今日" },
  { id: "week", label: "本周" },
  { id: "month", label: "本月" },
  { id: "quarter", label: "本季" },
]

export function TimeRangeSelector(props: Props) {
  return (
    <div class="flex gap-2">
      {opts.map((o) => (
        <button
          class={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium ${
            props.value === o.id ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
          }`}
          onClick={() => props.onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
