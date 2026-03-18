import { A } from "@solidjs/router"
import { Package } from "lucide-solid"
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import type { McpItem } from "../../stores/mcp"

type Props = {
  mcp: McpItem
}

const healthVariant = (s?: string) => {
  if (s === "healthy") return "success" as const
  if (s === "unhealthy") return "error" as const
  return "default" as const
}

export function McpCard(props: Props) {
  const m = () => props.mcp
  return (
    <A href={`/mcp/${m().id}`}>
      <Card clickable class="h-full hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
            <Package size={20} class="text-[var(--color-primary)]" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold text-[var(--color-text-primary)] mb-1 truncate">{m().display_name}</h3>
            <p class="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-2">{m().description ?? m().name}</p>
            <div class="flex gap-2 flex-wrap">
              <Badge variant="default">{m().visibility}</Badge>
              <Badge variant={healthVariant(m().health_status)}>
                {m().health_status === "healthy" ? "正常" : m().health_status === "unhealthy" ? "异常" : "未知"}
              </Badge>
              {(m().tags ?? []).slice(0, 2).map((t) => (
                <Badge variant="info">{t}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </A>
  )
}
