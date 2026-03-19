import { createResource, createSignal, Show, For } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { TokenChart } from "../components/dashboard/TokenChart"
import { KpiCard } from "../components/dashboard/KpiCard"
import { TimeRangeSelector } from "../components/dashboard/TimeRangeSelector"
import { fmtNum } from "../lib/format"
import { RefreshCw } from "lucide-solid"

type Range = "day" | "week" | "month" | "quarter"
const DAYS: Record<Range, number> = { day: 1, week: 7, month: 30, quarter: 90 }

type ActiveUser = { user_id: string; name: string; avatar_url: string; requests: number; tokens: number; sessions: number }
type McpEntry = { mcp: string; calls: number; users: number }
type ModelEntry = { model: string; requests: number; tokens: number }
type ToolEntry = { tool: string; mcp: string; calls: number }
type Activity = { id: string; user_name: string; avatar_url: string; action: string; model_id: string; tokens_input: number; tokens_output: number; created_at: string }

function Avatar(props: { src?: string; name?: string; size?: number }) {
  const s = props.size ?? 32
  return (
    <Show when={props.src} fallback={
      <div class="rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-semibold text-xs shrink-0" style={{ width: `${s}px`, height: `${s}px` }}>
        {(props.name ?? "?")[0]}
      </div>
    }>
      <img src={props.src} alt={props.name} class="rounded-full shrink-0 object-cover" style={{ width: `${s}px`, height: `${s}px` }} />
    </Show>
  )
}

function ProgressBar(props: { value: number; max: number; color?: string }) {
  const pct = () => props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0
  return (
    <div class="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden flex-1">
      <div class="h-full rounded-full transition-all duration-500" style={{ width: `${pct()}%`, background: props.color ?? "var(--color-primary)" }} />
    </div>
  )
}

export default function Dashboard() {
  const [range, setRange] = createSignal<Range>("week")
  const [ver, setVer] = createSignal(0)
  const [refreshing, setRefreshing] = createSignal(false)
  const days = () => DAYS[range()]

  const deps = () => ({ r: range(), v: ver() })

  const [overview] = createResource(deps, ({ r }) =>
    api.get<{ total_tokens?: number; total_cost?: number; total_sessions?: number; active_users?: number }>(`/dashboard/overview?range=${r}`),
  )
  const [trend] = createResource(deps, () => api.get<{ trend: { day: string; tokens_in: number; tokens_out: number }[] }>(`/dashboard/trend?days=${days()}`))
  const [users] = createResource(deps, ({ r }) => api.get<{ users: ActiveUser[] }>(`/dashboard/active-users?range=${r}`))
  const [mcps] = createResource(deps, ({ r }) => api.get<{ mcps: McpEntry[] }>(`/dashboard/mcp-leaderboard?range=${r}`))
  const [models] = createResource(deps, ({ r }) => api.get<{ models: ModelEntry[] }>(`/dashboard/model-distribution?range=${r}`))
  const [tools] = createResource(deps, () => api.get<{ tools: ToolEntry[] }>(`/dashboard/top-tools?days=${days()}`))
  const [activity] = createResource(deps, () => api.get<{ activity: Activity[] }>("/dashboard/recent-activity"))

  const trendData = () => {
    const t = trend()?.trend
    if (!t?.length) return []
    return t.map((p) => ({
      day: typeof p.day === "string" ? p.day : new Date(p.day).toISOString().slice(0, 10),
      tokens_in: Number(p.tokens_in ?? 0),
      tokens_out: Number(p.tokens_out ?? 0),
    }))
  }

  async function refresh() {
    setRefreshing(true)
    setVer((v) => v + 1)
    setTimeout(() => setRefreshing(false), 600)
  }

  const maxUserReq = () => Math.max(...(users()?.users ?? []).map((u) => u.requests), 1)
  const maxMcpCalls = () => Math.max(...(mcps()?.mcps ?? []).map((m) => m.calls), 1)
  const totalModelReq = () => (models()?.models ?? []).reduce((s, m) => s + m.requests, 0) || 1

  const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#4f46e5", "#be185d"]

  return (
    <div class="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">仪表盘</h1>
        <div class="flex items-center gap-3">
          <TimeRangeSelector value={range()} onChange={setRange} />
          <button
            onClick={refresh}
            class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors text-[var(--color-text-secondary)]"
            title="刷新数据"
          >
            <RefreshCw size={14} class={refreshing() ? "animate-spin" : ""} />
            刷新
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="总 Token 用量" value={fmtNum(overview()?.total_tokens ?? 0)} loading={overview.loading} />
        <KpiCard label="总成本 (USD)" value={`$${(overview()?.total_cost ?? 0).toFixed(4)}`} loading={overview.loading} />
        <KpiCard label="活跃用户" value={overview()?.active_users ?? 0} loading={overview.loading} />
        <KpiCard label="会话数" value={overview()?.total_sessions ?? 0} loading={overview.loading} />
      </div>

      {/* Token trend */}
      <Card class="mb-6">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">Token 趋势 ({days()}天)</h3>
        <TokenChart data={trendData()} loading={trend.loading} />
      </Card>

      {/* Two columns: Active users + MCP leaderboard */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Active users */}
        <Card>
          <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">活跃用户 Top 10</h3>
          <Show when={!users.loading} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">加载中...</div>}>
            <Show when={(users()?.users?.length ?? 0) > 0} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">暂无数据</div>}>
              <div class="space-y-3">
                <For each={users()?.users ?? []}>
                  {(u, idx) => (
                    <div class="flex items-center gap-3">
                      <span class="text-xs font-mono text-[var(--color-text-muted)] w-5 text-right">{idx() + 1}</span>
                      <Avatar src={u.avatar_url} name={u.name} size={28} />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                          <span class="text-sm font-medium truncate text-[var(--color-text-primary)]">{u.name || "未知用户"}</span>
                          <span class="text-xs text-[var(--color-text-muted)] shrink-0 ml-2">{u.requests} 次 · {fmtNum(Number(u.tokens))} tokens</span>
                        </div>
                        <ProgressBar value={u.requests} max={maxUserReq()} color={COLORS[idx() % COLORS.length]} />
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Card>

        {/* MCP leaderboard */}
        <Card>
          <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">MCP 使用排行</h3>
          <Show when={!mcps.loading} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">加载中...</div>}>
            <Show when={(mcps()?.mcps?.length ?? 0) > 0} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">暂无数据</div>}>
              <div class="space-y-3">
                <For each={mcps()?.mcps ?? []}>
                  {(m, idx) => (
                    <div class="flex items-center gap-3">
                      <span class="text-xs font-mono text-[var(--color-text-muted)] w-5 text-right">{idx() + 1}</span>
                      <div class="w-7 h-7 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                        <span class="text-xs font-bold text-[var(--color-primary)]">{(m.mcp ?? "?")[0].toUpperCase()}</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                          <span class="text-sm font-medium truncate text-[var(--color-text-primary)]">{m.mcp}</span>
                          <span class="text-xs text-[var(--color-text-muted)] shrink-0 ml-2">{m.calls} 次调用 · {m.users} 用户</span>
                        </div>
                        <ProgressBar value={m.calls} max={maxMcpCalls()} color={COLORS[(idx() + 2) % COLORS.length]} />
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Card>
      </div>

      {/* Two columns: Model distribution + Top tools */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Model distribution */}
        <Card>
          <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">模型使用分布</h3>
          <Show when={!models.loading} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">加载中...</div>}>
            <Show when={(models()?.models?.length ?? 0) > 0} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">暂无数据</div>}>
              <div class="space-y-3">
                <For each={models()?.models ?? []}>
                  {(m, idx) => {
                    const pct = () => ((m.requests / totalModelReq()) * 100).toFixed(1)
                    return (
                      <div class="flex items-center gap-3">
                        <div class="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[idx() % COLORS.length] }} />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center justify-between">
                            <span class="text-sm font-medium truncate text-[var(--color-text-primary)]">{m.model || "unknown"}</span>
                            <span class="text-xs text-[var(--color-text-muted)] shrink-0 ml-2">{pct()}% · {m.requests} 次</span>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                </For>
                {/* Simple bar chart */}
                <div class="flex rounded-lg overflow-hidden h-3 mt-2">
                  <For each={models()?.models ?? []}>
                    {(m, idx) => (
                      <div
                        class="h-full transition-all duration-500"
                        style={{ width: `${(m.requests / totalModelReq()) * 100}%`, background: COLORS[idx() % COLORS.length] }}
                        title={`${m.model}: ${m.requests}`}
                      />
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </Show>
        </Card>

        {/* Top tools */}
        <Card>
          <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">热门工具 Top 10</h3>
          <Show when={!tools.loading} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">加载中...</div>}>
            <Show when={(tools()?.tools?.length ?? 0) > 0} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">暂无数据</div>}>
              <div class="space-y-2">
                <For each={(tools()?.tools ?? []).slice(0, 10)}>
                  {(t, idx) => (
                    <div class="flex items-center gap-3 py-1">
                      <span class="text-xs font-mono text-[var(--color-text-muted)] w-5 text-right">{idx() + 1}</span>
                      <div class="flex-1 min-w-0">
                        <span class="text-sm font-medium text-[var(--color-text-primary)]">{t.tool}</span>
                        <Show when={t.mcp}>
                          <span class="text-[11px] text-[var(--color-text-muted)] ml-1.5">({t.mcp})</span>
                        </Show>
                      </div>
                      <span class="text-xs font-mono text-[var(--color-text-muted)] shrink-0">{t.calls}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">最近活动</h3>
        <Show when={!activity.loading} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">加载中...</div>}>
          <Show when={(activity()?.activity?.length ?? 0) > 0} fallback={<div class="text-sm text-[var(--color-text-muted)] py-6 text-center">暂无数据</div>}>
            <div class="space-y-2">
              <For each={(activity()?.activity ?? []).slice(0, 10)}>
                {(a) => {
                  const time = () => {
                    const d = new Date(a.created_at)
                    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
                  }
                  return (
                    <div class="flex items-center gap-3 py-1.5">
                      <Avatar src={a.avatar_url} name={a.user_name} size={24} />
                      <span class="text-sm text-[var(--color-text-primary)] font-medium truncate">{a.user_name || "未知"}</span>
                      <span class="text-xs text-[var(--color-text-muted)]">{a.action}</span>
                      <Show when={a.model_id}>
                        <span class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-text-muted)]">{a.model_id}</span>
                      </Show>
                      <div class="flex-1" />
                      <span class="text-xs text-[var(--color-text-muted)] shrink-0 font-mono">{fmtNum(Number(a.tokens_input ?? 0) + Number(a.tokens_output ?? 0))} tok</span>
                      <span class="text-[11px] text-[var(--color-text-muted)] shrink-0">{time()}</span>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
        </Show>
      </Card>
    </div>
  )
}
