import { Show } from "solid-js"
import { Card } from "../ui/Card"
import { Skeleton } from "../ui/Skeleton"

type Props = {
  label: string
  value: string | number
  loading?: boolean
  trend?: number
  trendLabel?: string
}

export function KpiCard(props: Props) {
  const up = () => props.trend !== undefined && props.trend > 0
  const down = () => props.trend !== undefined && props.trend < 0

  return (
    <Card>
      <h3 class="text-sm font-medium text-[var(--color-text-muted)] mb-1">{props.label}</h3>
      {props.loading ? <Skeleton height={36} /> : <p class="text-3xl font-bold tabular-nums">{props.value}</p>}
      <Show when={up() || down()}>
        <p class="text-xs mt-1 flex items-center gap-1">
          <span
            class={up() ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}
          >
            {up() ? "↑" : "↓"} {Math.abs(props.trend!)}%
          </span>
          <Show when={props.trendLabel}>
            <span class="text-[var(--color-text-muted)]">{props.trendLabel}</span>
          </Show>
        </p>
      </Show>
    </Card>
  )
}
