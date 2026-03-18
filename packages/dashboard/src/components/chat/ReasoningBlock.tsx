import { createSignal } from "solid-js"
import { ChevronDown, ChevronRight } from "lucide-solid"

type Props = {
  text: string
  duration?: number
  expanded?: boolean
}

export function ReasoningBlock(props: Props) {
  const [open, setOpen] = createSignal(props.expanded ?? false)

  return (
    <div class="rounded-[var(--radius-md)] border-l-2 border-l-[var(--color-accent)] pl-3 py-2 mb-2 bg-[var(--color-muted)]">
      <button
        class="w-full flex items-center gap-2 text-left text-sm text-[var(--color-text-muted)] italic"
        onClick={() => setOpen((o) => !o)}
      >
        {open() ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        思考 {props.duration != null && `${(props.duration / 1000).toFixed(1)}s`}
      </button>
      {open() && <p class="mt-1 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{props.text}</p>}
    </div>
  )
}
