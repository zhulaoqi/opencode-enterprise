import { createResource, createSignal, Show, For } from "solid-js"
import { Plus, X, Pencil, Trash2, Globe, Users, User, ArrowDownToLine, ArrowUpFromLine, DollarSign, Hash, AlertCircle } from "lucide-solid"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Button } from "../components/ui/Button"
import { notify } from "../stores/notification"

type Quota = {
  id: string
  scope_type: string
  scope_id: string
  period: string
  max_tokens: number
  max_requests?: number
  max_cost_usd?: string
  tokens_used: number
  input_used: number
  output_used: number
  requests_used: number
  cost_used: number
}

type Form = {
  scope_type: string
  scope_id: string
  period: string
  max_tokens: string
  max_requests: string
  max_cost_usd: string
}

const blank: Form = { scope_type: "global", scope_id: "", period: "monthly", max_tokens: "", max_requests: "", max_cost_usd: "" }

function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(n)
}

function pct(used: number, max: number) {
  return max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
}

function bar(value: number, color: string) {
  return (
    <div class="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
      <div class="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  )
}

function ScopeIcon(props: { type: string; size?: number }) {
  const s = props.size ?? 16
  switch (props.type) {
    case "global": return <Globe size={s} class="text-blue-500" />
    case "department": return <Users size={s} class="text-amber-500" />
    default: return <User size={s} class="text-emerald-500" />
  }
}

const scopeInfo: Record<string, { label: string; color: string }> = {
  global: { label: "全局", color: "#3b82f6" },
  department: { label: "部门", color: "#f59e0b" },
  user: { label: "用户", color: "#10b981" },
}
const periodLabel: Record<string, string> = { daily: "每日", monthly: "每月" }

const input = "w-full h-10 px-3 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-blue-500/10"

export default function Quotas() {
  const [data, { refetch }] = createResource(() => api.get<{ quotas: Quota[] }>("/billing/quotas-with-usage"))
  const [dialog, setDialog] = createSignal<"create" | "edit" | null>(null)
  const [editing, setEditing] = createSignal<Quota | null>(null)
  const [form, setForm] = createSignal<Form>({ ...blank })
  const [saving, setSaving] = createSignal(false)

  const quotas = () => data()?.quotas ?? []

  const openCreate = () => {
    setForm({ ...blank })
    setEditing(null)
    setDialog("create")
  }

  const openEdit = (q: Quota) => {
    setForm({
      scope_type: q.scope_type,
      scope_id: q.scope_id,
      period: q.period,
      max_tokens: String(q.max_tokens),
      max_requests: q.max_requests != null ? String(q.max_requests) : "",
      max_cost_usd: q.max_cost_usd ?? "",
    })
    setEditing(q)
    setDialog("edit")
  }

  const close = () => { setDialog(null); setEditing(null) }

  const save = async () => {
    const f = form()
    const tokens = parseInt(f.max_tokens, 10)
    if (isNaN(tokens) || tokens <= 0) { notify("error", "请输入有效的 Token 上限"); return }
    setSaving(true)
    try {
      await api.post("/billing/quotas", {
        scope_type: f.scope_type,
        scope_id: f.scope_id || "",
        period: f.period,
        max_tokens: tokens,
        max_requests: f.max_requests ? parseInt(f.max_requests, 10) : undefined,
        max_cost_usd: f.max_cost_usd || undefined,
      })
      notify("success", dialog() === "create" ? "配额规则已创建" : "配额规则已更新")
      close()
      refetch()
    } catch (e) {
      notify("error", String(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (q: Quota) => {
    if (!window.confirm(`确定删除此配额规则？`)) return
    try {
      await api.del(`/billing/quotas/${q.id}`)
      notify("success", "已删除")
      refetch()
    } catch (e) {
      notify("error", String(e))
    }
  }

  return (
    <div class="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div class="flex items-center justify-between mb-1">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">配额管理</h1>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={16} class="mr-1" /> 新增配额
        </Button>
      </div>
      <p class="text-sm text-[var(--color-text-muted)] mb-6">
        按行业标准管理 Token 消耗：分别统计输入/输出 Token，按模型定价计费（$/1M tokens），支持多维度限额。
      </p>

      <Show when={data.loading}><Skeleton height={200} /></Show>
      <Show when={data.error}><p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p></Show>

      <Show when={!data.loading && !data.error}>
        <Show when={quotas().length === 0}>
          <Card>
            <div class="py-16 text-center">
              <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Globe size={28} class="text-blue-400" />
              </div>
              <h3 class="text-base font-semibold text-[var(--color-text-primary)] mb-1">还没有配额规则</h3>
              <p class="text-sm text-[var(--color-text-muted)] mb-5 max-w-xs mx-auto">
                创建配额规则来限制 Token 消耗量，控制成本。支持全局、部门、用户三级配额。
              </p>
              <Button variant="primary" size="sm" onClick={openCreate}>
                <Plus size={16} class="mr-1" /> 创建第一个配额
              </Button>
            </div>
          </Card>
        </Show>

        <div class="space-y-4">
          <For each={quotas()}>
            {(q) => {
              const info = scopeInfo[q.scope_type] ?? scopeInfo.user
              const p = pct(q.tokens_used, q.max_tokens)
              const costP = q.max_cost_usd ? pct(q.cost_used, Number(q.max_cost_usd)) : 0
              const warn = p >= 80 || costP >= 80
              return (
                <Card>
                  <div class="p-5">
                    {/* Title row */}
                    <div class="flex items-center justify-between mb-4">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: info.color + "15" }}>
                          <ScopeIcon type={q.scope_type} size={18} />
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="font-semibold text-sm text-[var(--color-text-primary)]">{info.label}配额</span>
                            <Show when={q.scope_id}>
                              <code class="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-text-secondary)] font-mono">
                                {q.scope_id}
                              </code>
                            </Show>
                          </div>
                          <span class="text-xs text-[var(--color-text-muted)]">{periodLabel[q.period] ?? q.period}重置</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <Show when={warn}>
                          <span class="mr-2 inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <AlertCircle size={12} /> 即将耗尽
                          </span>
                        </Show>
                        <button class="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)] transition-colors" onClick={() => openEdit(q)} title="编辑">
                          <Pencil size={14} />
                        </button>
                        <button class="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] transition-colors" onClick={() => remove(q)} title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Metrics grid */}
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Total tokens */}
                      <div class="space-y-2">
                        <div class="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <Hash size={12} />
                          <span>Token 总量</span>
                        </div>
                        <div class="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                          {fmt(q.tokens_used)}
                          <span class="text-xs font-normal text-[var(--color-text-muted)]"> / {fmt(q.max_tokens)}</span>
                        </div>
                        {bar(p, p >= 90 ? "#ef4444" : p >= 70 ? "#f59e0b" : "#3b82f6")}
                        <span class="text-[11px] tabular-nums text-[var(--color-text-muted)]">{p}% 已使用</span>
                      </div>

                      {/* Input tokens */}
                      <div class="space-y-2">
                        <div class="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <ArrowDownToLine size={12} />
                          <span>输入 Token</span>
                        </div>
                        <div class="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{fmt(q.input_used)}</div>
                        {bar(q.max_tokens > 0 ? (q.input_used / q.max_tokens) * 100 : 0, "#6366f1")}
                        <span class="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                          {q.tokens_used > 0 ? Math.round((q.input_used / q.tokens_used) * 100) : 0}% 占比
                        </span>
                      </div>

                      {/* Output tokens */}
                      <div class="space-y-2">
                        <div class="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <ArrowUpFromLine size={12} />
                          <span>输出 Token</span>
                        </div>
                        <div class="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{fmt(q.output_used)}</div>
                        {bar(q.max_tokens > 0 ? (q.output_used / q.max_tokens) * 100 : 0, "#8b5cf6")}
                        <span class="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                          {q.tokens_used > 0 ? Math.round((q.output_used / q.tokens_used) * 100) : 0}% 占比
                        </span>
                      </div>

                      {/* Cost */}
                      <div class="space-y-2">
                        <div class="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <DollarSign size={12} />
                          <span>累计费用</span>
                        </div>
                        <div class="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                          ${q.cost_used.toFixed(4)}
                          <Show when={q.max_cost_usd}>
                            <span class="text-xs font-normal text-[var(--color-text-muted)]"> / ${Number(q.max_cost_usd).toFixed(2)}</span>
                          </Show>
                        </div>
                        <Show when={q.max_cost_usd} fallback={
                          <div class="h-1.5 rounded-full bg-[var(--color-muted)]" />
                        }>
                          {bar(costP, costP >= 90 ? "#ef4444" : costP >= 70 ? "#f59e0b" : "#10b981")}
                        </Show>
                        <span class="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                          {q.requests_used.toLocaleString()} 次请求
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            }}
          </For>
        </div>

        {/* Industry reference */}
        <Show when={quotas().length > 0}>
          <div class="mt-6 p-4 rounded-xl bg-[var(--color-muted)] text-xs text-[var(--color-text-muted)] space-y-1">
            <p class="font-medium text-[var(--color-text-secondary)]">行业参考定价 ($/1M tokens)</p>
            <div class="flex flex-wrap gap-x-6 gap-y-1">
              <span>GPT-4o: 输入 $2.5 / 输出 $10</span>
              <span>GPT-4o-mini: 输入 $0.15 / 输出 $0.6</span>
              <span>Claude Sonnet 4: 输入 $3 / 输出 $15</span>
              <span>Gemini 2.0 Flash: 输入 $0.1 / 输出 $0.4</span>
            </div>
          </div>
        </Show>
      </Show>

      {/* Dialog */}
      <Show when={dialog()}>
        <div class="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
          <div class="relative bg-[var(--color-bg-elevated)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
                {dialog() === "create" ? "新增配额规则" : "编辑配额规则"}
              </h2>
              <button class="p-1 rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-text-muted)]" onClick={close}>
                <X size={18} />
              </button>
            </div>

            <div class="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <Show when={dialog() === "create"} fallback={
                <div class="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-muted)]">
                  <ScopeIcon type={form().scope_type} />
                  <div class="text-sm">
                    <span class="font-medium">{scopeInfo[form().scope_type]?.label}配额</span>
                    <Show when={form().scope_id}>
                      <span class="text-[var(--color-text-muted)]"> · {form().scope_id}</span>
                    </Show>
                    <span class="text-[var(--color-text-muted)]"> · {periodLabel[form().period]}</span>
                  </div>
                </div>
              }>
                {/* Scope type */}
                <div>
                  <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">适用范围</label>
                  <div class="grid grid-cols-3 gap-2">
                    <For each={["global", "department", "user"] as const}>
                      {(t) => (
                        <button
                          class={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm transition-all ${form().scope_type === t ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"}`}
                          onClick={() => setForm((f) => ({ ...f, scope_type: t, scope_id: t === "global" ? "" : f.scope_id }))}
                        >
                          <ScopeIcon type={t} size={20} />
                          <span class="font-medium">{scopeInfo[t].label}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Scope ID */}
                <Show when={form().scope_type !== "global"}>
                  <div>
                    <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {form().scope_type === "department" ? "部门 ID" : "用户 ID"}
                    </label>
                    <input
                      class={input}
                      placeholder={form().scope_type === "department" ? "输入飞书部门 ID" : "输入用户内部 ID（可从用户管理页复制）"}
                      value={form().scope_id}
                      onInput={(e) => setForm((f) => ({ ...f, scope_id: e.currentTarget.value }))}
                    />
                  </div>
                </Show>

                {/* Period */}
                <div>
                  <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">重置周期</label>
                  <div class="grid grid-cols-2 gap-2">
                    <For each={["daily", "monthly"] as const}>
                      {(p) => (
                        <button
                          class={`h-10 rounded-xl border text-sm font-medium transition-all ${form().period === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"}`}
                          onClick={() => setForm((f) => ({ ...f, period: p }))}
                        >
                          {periodLabel[p]}重置
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Divider */}
              <div class="flex items-center gap-3">
                <div class="flex-1 h-px bg-[var(--color-border)]" />
                <span class="text-xs text-[var(--color-text-muted)]">限额设置</span>
                <div class="flex-1 h-px bg-[var(--color-border)]" />
              </div>

              {/* Max tokens */}
              <div>
                <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Token 上限 <span class="text-[var(--color-text-muted)] font-normal">(输入+输出总计)</span>
                </label>
                <input
                  class={input}
                  type="number"
                  placeholder="例如: 1000000 (1M)"
                  value={form().max_tokens}
                  onInput={(e) => setForm((f) => ({ ...f, max_tokens: e.currentTarget.value }))}
                />
                <div class="mt-1.5 flex gap-2">
                  <For each={[["100K", "100000"], ["500K", "500000"], ["1M", "1000000"], ["5M", "5000000"], ["10M", "10000000"]]}>
                    {([label, val]) => (
                      <button
                        class="px-2 py-0.5 text-xs rounded-md bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
                        onClick={() => setForm((f) => ({ ...f, max_tokens: val }))}
                      >
                        {label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Max requests */}
              <div>
                <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  请求次数上限 <span class="text-[var(--color-text-muted)] font-normal">(可选)</span>
                </label>
                <input
                  class={input}
                  type="number"
                  placeholder="留空表示不限制"
                  value={form().max_requests}
                  onInput={(e) => setForm((f) => ({ ...f, max_requests: e.currentTarget.value }))}
                />
              </div>

              {/* Max cost */}
              <div>
                <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  费用上限 (USD) <span class="text-[var(--color-text-muted)] font-normal">(可选)</span>
                </label>
                <input
                  class={input}
                  type="number"
                  step="0.01"
                  placeholder="例如: 50.00"
                  value={form().max_cost_usd}
                  onInput={(e) => setForm((f) => ({ ...f, max_cost_usd: e.currentTarget.value }))}
                />
                <p class="mt-1 text-xs text-[var(--color-text-muted)]">
                  系统按模型实际定价自动计费（输出 Token 通常为输入的 3-5 倍价格）
                </p>
              </div>
            </div>

            <div class="px-6 py-4 border-t border-[var(--color-border)] flex gap-2 justify-end bg-[var(--color-bg-sunken)]">
              <Button variant="secondary" size="sm" onClick={close}>取消</Button>
              <Button variant="primary" size="sm" onClick={save} loading={saving()}>
                {dialog() === "create" ? "创建" : "保存修改"}
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
