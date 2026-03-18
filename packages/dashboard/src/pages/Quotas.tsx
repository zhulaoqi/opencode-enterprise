import { createResource } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { ProgressBar } from "../components/ui/ProgressBar"
import { fmtNum } from "../lib/format"

type QuotaWithUsage = {
  id: string
  scope_type: string
  scope_id: string
  period: string
  max_tokens: number
  max_requests?: number
  tokens_used: number
  requests_used: number
  cost_used: number
}

const scopeLabel = (t: string) => (t === "global" ? "全局" : t === "department" ? "部门" : t === "user" ? "用户" : t)
const periodLabel = (p: string) => (p === "daily" ? "日" : p === "monthly" ? "月" : p)

export default function Quotas() {
  const [data] = createResource(() => api.get<{ quotas: QuotaWithUsage[] }>("/billing/quotas-with-usage"))

  const grouped = () => {
    const q = data()?.quotas ?? []
    const byScope: Record<string, QuotaWithUsage[]> = {}
    for (const item of q) {
      const k = item.scope_type
      if (!byScope[k]) byScope[k] = []
      byScope[k].push(item)
    }
    return ["global", "department", "user"].filter((k) => byScope[k]?.length).map((k) => ({ scope: k, items: byScope[k]! }))
  }

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-4">配额管理</h1>
      {data.loading && <Skeleton height={200} />}
      {data.error && <p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p>}
      {data() && (
        <div class="space-y-6">
          {grouped().map((g) => (
            <Card>
              <h2 class="font-semibold text-[var(--color-text-primary)] mb-4">{scopeLabel(g.scope)}</h2>
              <div class="space-y-4">
                {g.items.map((q) => (
                  <div class="flex flex-col gap-2 py-3 px-4 rounded-[var(--radius-md)] bg-[var(--color-muted)]">
                    <div class="flex justify-between text-sm">
                      <span class="font-mono text-xs truncate max-w-[200px]" title={q.scope_id}>
                        {q.scope_id}
                      </span>
                      <span class="text-[var(--color-text-muted)]">{periodLabel(q.period)}配额</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <ProgressBar value={q.tokens_used} max={q.max_tokens} class="flex-1" />
                      <span class="text-sm tabular-nums shrink-0">
                        {fmtNum(q.tokens_used)} / {fmtNum(q.max_tokens)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {grouped().length === 0 && <p class="text-[var(--color-text-muted)]">暂无配额配置</p>}
        </div>
      )}
    </div>
  )
}
