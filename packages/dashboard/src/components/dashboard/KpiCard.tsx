import { Card } from "../ui/Card"
import { Skeleton } from "../ui/Skeleton"

type Props = {
  label: string
  value: string | number
  loading?: boolean
}

export function KpiCard(props: Props) {
  return (
    <Card>
      <h3 class="text-sm font-medium text-[var(--color-text-muted)] mb-1">{props.label}</h3>
      {props.loading ? <Skeleton height={36} /> : <p class="text-3xl font-bold tabular-nums">{props.value}</p>}
    </Card>
  )
}
