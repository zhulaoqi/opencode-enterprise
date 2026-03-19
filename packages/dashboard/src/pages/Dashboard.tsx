import { createResource, createSignal } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { TokenChart } from "../components/dashboard/TokenChart"
import { DeptChart } from "../components/dashboard/DeptChart"
import { KpiCard } from "../components/dashboard/KpiCard"
import { TimeRangeSelector } from "../components/dashboard/TimeRangeSelector"
import { ToolRanking } from "../components/dashboard/ToolRanking"
import { fmtNum } from "../lib/format"

type Range = "day" | "week" | "month" | "quarter"

export default function Dashboard() {
  const [range, setRange] = createSignal<Range>("month")
  const [overview] = createResource(
    () => ({ r: range() }),
    ({ r }) =>
      api.get<{
        total_tokens?: number
        total_cost?: number
        total_sessions?: number
        active_users?: number
      }>(`/dashboard/overview?range=${r}`)
  )
  const [dept] = createResource(() => api.get<{ departments: { scope_id: string; tokens: number }[] }>("/dashboard/by-department"))
  const [tools] = createResource(() => api.get<{ tools: { tool: string; calls: number }[] }>("/dashboard/top-tools?days=30"))
  const [trend] = createResource(() => api.get<{ trend: { day: string; tokens_in: number; tokens_out: number }[] }>("/dashboard/trend?days=30"))

  const trendData = () => {
    const t = trend()?.trend
    if (!t?.length) return []
    return t.map((p) => ({
      day: typeof p.day === "string" ? p.day : new Date(p.day).toISOString().slice(0, 10),
      tokens_in: Number(p.tokens_in ?? 0),
      tokens_out: Number(p.tokens_out ?? 0),
    }))
  }

  return (
    <div class="p-4 max-w-5xl mx-auto">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-4">仪表盘</h1>
      <div class="mb-6">
        <TimeRangeSelector value={range()} onChange={setRange} />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="总 Token 用量" value={fmtNum(overview()?.total_tokens ?? 0)} loading={overview.loading} />
        <KpiCard label="总成本 (USD)" value={`$${overview()?.total_cost ?? "0"}`} loading={overview.loading} />
        <KpiCard label="活跃用户" value={overview()?.active_users ?? 0} loading={overview.loading} />
        <KpiCard label="会话数" value={overview()?.total_sessions ?? 0} loading={overview.loading} />
      </div>
      <Card class="mb-6">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">Token 趋势 (30天)</h3>
        <TokenChart data={trendData()} loading={trend.loading} />
      </Card>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">部门用量</h3>
          <DeptChart data={dept()?.departments ?? []} loading={dept.loading} />
        </Card>
        <Card>
          <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">Top 工具</h3>
          <ToolRanking items={tools()?.tools ?? []} loading={tools.loading} limit={5} />
        </Card>
      </div>
    </div>
  )
}
