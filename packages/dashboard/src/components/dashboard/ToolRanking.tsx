import { Badge } from "../ui/Badge"
import { Skeleton } from "../ui/Skeleton"

type Item = { tool: string; calls: number }

type Props = {
  items: Item[]
  loading?: boolean
  limit?: number
}

export function ToolRanking(props: Props) {
  const list = () => (props.limit ? props.items.slice(0, props.limit) : props.items)
  return (
    <>
      {props.loading && <Skeleton height={120} />}
      {!props.loading && list().length ? (
        <div class="space-y-2">
          {list().map((t) => (
            <div class="flex justify-between items-center text-sm py-2 px-3 rounded-[var(--radius-md)] bg-[var(--color-muted)]">
              <span class="truncate font-mono">{t.tool}</span>
              <Badge variant="default">{t.calls}</Badge>
            </div>
          ))}
        </div>
      ) : !props.loading && <p class="text-[var(--color-text-muted)] text-sm">暂无数据</p>}
    </>
  )
}
