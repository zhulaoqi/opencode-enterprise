import { createSignal } from "solid-js"
import { ChevronDown, ChevronRight } from "lucide-solid"
import { Badge } from "../ui/Badge"

type Props = {
  name: string
  mcp?: string
  status: "executing" | "success" | "error"
  duration?: number
  input?: unknown
  output?: unknown
}

const statusVariant = { executing: "info" as const, success: "success" as const, error: "error" as const }

export function ToolCallCard(props: Props) {
  const [expanded, setExpanded] = createSignal(false)
  const status = () => props.status

  return (
    <div
      class={`rounded-[var(--radius-lg)] border-l-4 pl-4 py-2 mb-2 bg-[var(--color-bg-elevated)] border-[var(--color-border)] ${status() === "executing" ? "border-l-[var(--color-primary)] animate-pulse" : ""}`}
    >
      <button
        class="w-full flex items-center gap-2 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span class="font-medium text-sm">{props.name}</span>
        {props.mcp && <span class="text-xs text-[var(--color-text-muted)]">({props.mcp})</span>}
        <Badge variant={statusVariant[status()]} class="ml-auto">
          {status() === "executing" ? "执行中" : status() === "success" ? "成功" : "失败"}
        </Badge>
        {props.duration != null && (
          <span class="text-xs text-[var(--color-text-muted)] tabular-nums">{props.duration}ms</span>
        )}
      </button>
      {expanded() && (props.input != null || props.output != null) && (
        <pre class="mt-2 p-2 rounded text-xs bg-[var(--color-muted)] overflow-auto max-h-40">
          {JSON.stringify({ input: props.input, output: props.output }, null, 2)}
        </pre>
      )}
    </div>
  )
}
