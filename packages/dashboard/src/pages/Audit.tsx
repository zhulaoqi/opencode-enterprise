import { createResource, createSignal } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Badge } from "../components/ui/Badge"
import { fmtDate } from "../lib/format"

type AuditLog = {
  id: string
  user_id: string
  action: string
  tokens_input?: number
  tokens_output?: number
  cost_usd?: string
  created_at: string
}

export default function Audit() {
  const [userId, setUserId] = createSignal("")
  const [action, setAction] = createSignal("")
  const [filter, setFilter] = createSignal({ u: "", a: "" })
  const [data] = createResource(
    () => filter(),
    (f) => {
      const params = new URLSearchParams()
      if (f.u) params.set("user_id", f.u)
      if (f.a) params.set("action", f.a)
      return api.get<{ audit: AuditLog[] }>(`/billing/audit?${params}`)
    }
  )
  const applyFilter = () => setFilter({ u: userId(), a: action() })

  const isError = (a: string) => a.toLowerCase().includes("error") || a === "denied"

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-4">审计日志</h1>
      <div class="flex flex-wrap gap-2 mb-6">
        <input
          type="text"
          placeholder="用户 ID"
          class="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm w-40"
          value={userId()}
          onInput={(e) => setUserId(e.currentTarget.value)}
        />
        <input
          type="text"
          placeholder="操作类型"
          class="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm w-40"
          value={action()}
          onInput={(e) => setAction(e.currentTarget.value)}
        />
        <button
          class="h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-on-primary)] text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          onClick={applyFilter}
        >
          查询
        </button>
      </div>
      {data.loading && <Skeleton height={200} />}
      {data.error && <p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p>}
      {data()?.audit?.length ? (
        <Card>
          <div class="relative">
            <div class="absolute left-4 top-0 bottom-0 w-px bg-[var(--color-border)]" />
            <div class="space-y-0">
              {data()!.audit.map((a) => (
                <div class="relative flex gap-4 pl-12 py-4 border-b border-[var(--color-border)] last:border-0">
                  <div
                    class={`absolute left-2.5 w-3 h-3 rounded-full shrink-0 ${
                      isError(a.action) ? "bg-[var(--color-error)]" : "bg-[var(--color-success)]"
                    }`}
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant={isError(a.action) ? "error" : "success"}>{a.action}</Badge>
                      <span class="text-[var(--color-text-muted)] text-sm">{fmtDate(a.created_at)}</span>
                    </div>
                    <div class="text-sm text-[var(--color-text-secondary)] space-x-4">
                      <span>用户: {a.user_id?.slice(0, 8)}...</span>
                      {a.tokens_input != null && <span>输入: {a.tokens_input}</span>}
                      {a.tokens_output != null && <span>输出: {a.tokens_output}</span>}
                      {a.cost_usd != null && <span>成本: ${a.cost_usd}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : data() && <p class="text-[var(--color-text-muted)]">暂无审计记录</p>}
    </div>
  )
}
