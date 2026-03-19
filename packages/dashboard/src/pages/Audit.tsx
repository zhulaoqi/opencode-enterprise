import { createResource, createSignal, Show, For } from "solid-js"
import { ChevronDown, ChevronRight } from "lucide-solid"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Badge } from "../components/ui/Badge"
import { Button } from "../components/ui/Button"
import { fmtDate } from "../lib/format"

type AuditLog = {
  id: string
  user_id: string
  action: string
  tokens_input?: number
  tokens_output?: number
  cost_usd?: string
  created_at: string
  [key: string]: unknown
}

export default function Audit() {
  const [userId, setUserId] = createSignal("")
  const [action, setAction] = createSignal("")
  const [from, setFrom] = createSignal("")
  const [to, setTo] = createSignal("")
  const [filter, setFilter] = createSignal({ u: "", a: "", from: "", to: "" })
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})

  const [data] = createResource(
    () => filter(),
    (f) => {
      const params = new URLSearchParams()
      if (f.u) params.set("user_id", f.u)
      if (f.a) params.set("action", f.a)
      if (f.from) params.set("from", f.from)
      if (f.to) params.set("to", f.to)
      return api.get<{ audit: AuditLog[] }>(`/billing/audit?${params}`)
    }
  )

  const apply = () => setFilter({ u: userId(), a: action(), from: from(), to: to() })
  const isError = (a: string) => a.toLowerCase().includes("error") || a === "denied"
  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const exportCsv = () => {
    const list = data()?.audit ?? []
    const headers = ["时间", "用户", "操作", "输入Token", "输出Token", "成本"]
    const rows = list.map((a) => [
      fmtDate(a.created_at),
      a.user_id,
      a.action,
      a.tokens_input ?? "",
      a.tokens_output ?? "",
      a.cost_usd ?? "",
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    download(blob, `audit-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const exportJson = () => {
    const list = data()?.audit ?? []
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json;charset=utf-8" })
    download(blob, `audit-${new Date().toISOString().slice(0, 10)}.json`)
  }

  const inputCls = "h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-4">审计日志</h1>
      <div class="flex flex-wrap gap-2 mb-6">
        <input
          type="text"
          placeholder="用户 ID"
          class={`${inputCls} w-40`}
          value={userId()}
          onInput={(e) => setUserId(e.currentTarget.value)}
        />
        <input
          type="text"
          placeholder="操作类型"
          class={`${inputCls} w-40`}
          value={action()}
          onInput={(e) => setAction(e.currentTarget.value)}
        />
        <input
          type="date"
          class={`${inputCls} w-40`}
          value={from()}
          onInput={(e) => setFrom(e.currentTarget.value)}
          title="起始日期"
        />
        <input
          type="date"
          class={`${inputCls} w-40`}
          value={to()}
          onInput={(e) => setTo(e.currentTarget.value)}
          title="结束日期"
        />
        <Button variant="primary" size="sm" onClick={apply}>查询</Button>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!data()?.audit?.length}>导出 CSV</Button>
        <Button variant="secondary" size="sm" onClick={exportJson} disabled={!data()?.audit?.length}>导出 JSON</Button>
      </div>

      {data.loading && <Skeleton height={200} />}
      {data.error && <p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p>}

      {data()?.audit?.length ? (
        <Card>
          <div class="relative">
            <div class="absolute left-4 top-0 bottom-0 w-px bg-[var(--color-border)]" />
            <div class="space-y-0">
              <For each={data()!.audit}>
                {(entry) => (
                  <div class="relative border-b border-[var(--color-border)] last:border-0">
                    <div
                      class="flex gap-4 pl-12 py-4 cursor-pointer hover:bg-[var(--color-muted)] transition-colors"
                      onClick={() => toggle(entry.id)}
                    >
                      <div
                        class={`absolute left-2.5 top-5 w-3 h-3 rounded-full shrink-0 ${
                          isError(entry.action) ? "bg-[var(--color-error)]" : "bg-[var(--color-success)]"
                        }`}
                      />
                      <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant={isError(entry.action) ? "error" : "success"}>{entry.action}</Badge>
                          <span class="text-[var(--color-text-muted)] text-sm">{fmtDate(entry.created_at)}</span>
                          <span class="ml-auto text-[var(--color-text-muted)]">
                            {expanded()[entry.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        </div>
                        <div class="text-sm text-[var(--color-text-secondary)] space-x-4">
                          <span>用户: {entry.user_id?.slice(0, 8)}...</span>
                          {entry.tokens_input != null && <span>输入: {entry.tokens_input}</span>}
                          {entry.tokens_output != null && <span>输出: {entry.tokens_output}</span>}
                          {entry.cost_usd != null && <span>成本: ${entry.cost_usd}</span>}
                        </div>
                      </div>
                    </div>
                    <Show when={expanded()[entry.id]}>
                      <pre class="mx-12 mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-sunken)] text-xs text-[var(--color-text-secondary)] overflow-x-auto font-mono">
                        {JSON.stringify(entry, null, 2)}
                      </pre>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Card>
      ) : data() && <p class="text-[var(--color-text-muted)]">暂无审计记录</p>}
    </div>
  )
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
