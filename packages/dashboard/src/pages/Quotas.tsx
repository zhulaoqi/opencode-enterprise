import { createResource, createSignal, Show, For } from "solid-js"
import { ChevronDown, ChevronRight, X, Plus } from "lucide-solid"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { ProgressBar } from "../components/ui/ProgressBar"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { fmtNum } from "../lib/format"
import { notify } from "../stores/notification"

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

type PanelState = { mode: "edit"; quota: QuotaWithUsage } | { mode: "create" } | null

const scopeLabel = (t: string) => (t === "global" ? "全局" : t === "department" ? "部门" : t === "user" ? "用户" : t)
const periodLabel = (p: string) => (p === "daily" ? "日" : p === "monthly" ? "月" : p)
const scopes = ["global", "department", "user"] as const
const depths: Record<string, number> = { global: 0, department: 1, user: 2 }

export default function Quotas() {
  const [data, { refetch }] = createResource(() => api.get<{ quotas: QuotaWithUsage[] }>("/billing/quotas-with-usage"))
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({ global: true, department: true, user: true })
  const [panel, setPanel] = createSignal<PanelState>(null)
  const [form, setForm] = createSignal({ scope_type: "global", scope_id: "", period: "monthly", max_tokens: "", max_requests: "" })

  const grouped = () => {
    const q = data()?.quotas ?? []
    const byScope: Record<string, QuotaWithUsage[]> = {}
    for (const item of q) {
      const k = item.scope_type
      if (!byScope[k]) byScope[k] = []
      byScope[k].push(item)
    }
    return scopes.filter((k) => byScope[k]?.length).map((k) => ({ scope: k, items: byScope[k]! }))
  }

  const toggle = (scope: string) => setExpanded((e) => ({ ...e, [scope]: !e[scope] }))

  const openEdit = (q: QuotaWithUsage) => {
    setForm({ scope_type: q.scope_type, scope_id: q.scope_id, period: q.period, max_tokens: String(q.max_tokens), max_requests: q.max_requests != null ? String(q.max_requests) : "" })
    setPanel({ mode: "edit", quota: q })
  }

  const openCreate = () => {
    setForm({ scope_type: "global", scope_id: "", period: "monthly", max_tokens: "", max_requests: "" })
    setPanel({ mode: "create" })
  }

  const close = () => setPanel(null)

  const save = async () => {
    const f = form()
    const max = parseInt(f.max_tokens, 10)
    if (isNaN(max) || max < 0) {
      notify("error", "请输入有效数字")
      return
    }
    const p = panel()
    await api.post("/billing/quotas", {
      scope_type: f.scope_type,
      scope_id: f.scope_id,
      period: f.period,
      max_tokens: max,
      max_requests: f.max_requests ? parseInt(f.max_requests, 10) : undefined,
    }).then(() => {
      notify("success", p?.mode === "create" ? "已创建" : "已更新")
      close()
      refetch()
    }).catch((e) => notify("error", String(e)))
  }

  const indent = (scope: string) => `${depths[scope] * 16}px`
  const open = () => panel() !== null

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">配额管理</h1>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={16} />
          <span class="ml-1">新增规则</span>
        </Button>
      </div>

      {data.loading && <Skeleton height={200} />}
      {data.error && <p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p>}

      {data() && (
        <Card>
          <div class="divide-y divide-[var(--color-border)]">
            <For each={grouped()}>
              {(g) => (
                <div style={{ "padding-left": indent(g.scope) }}>
                  <button
                    class="w-full flex items-center gap-2 py-3 px-2 text-left font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] rounded-[var(--radius-md)] transition-colors"
                    onClick={() => toggle(g.scope)}
                  >
                    {expanded()[g.scope] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span class="text-sm">{scopeLabel(g.scope)}</span>
                    <span class="text-xs text-[var(--color-text-muted)] ml-auto">{g.items.length} 项</span>
                  </button>
                  <Show when={expanded()[g.scope]}>
                    <div class="pl-6 pb-2 space-y-1">
                      <For each={g.items}>
                        {(q) => (
                          <div class="flex items-center gap-2">
                            <div
                              class="flex-1 flex flex-col gap-1.5 py-2.5 px-3 rounded-[var(--radius-md)] bg-[var(--color-bg-sunken)] cursor-pointer hover:bg-[var(--color-border)] transition-colors"
                              onClick={() => openEdit(q)}
                            >
                              <div class="flex justify-between items-center text-sm">
                                <span class="font-mono text-xs truncate max-w-[200px]" title={q.scope_id}>
                                  {q.scope_id || "(默认)"}
                                </span>
                                <span class="text-xs text-[var(--color-text-muted)]">{periodLabel(q.period)}配额</span>
                              </div>
                              <div class="flex items-center gap-3">
                                <ProgressBar value={q.tokens_used} max={q.max_tokens} class="flex-1" />
                                <span class="text-xs tabular-nums shrink-0 text-[var(--color-text-secondary)]">
                                  {fmtNum(q.tokens_used)} / {fmtNum(q.max_tokens)}
                                </span>
                              </div>
                            </div>
                            <button
                              class="shrink-0 px-2 py-1 text-xs rounded-[var(--radius-md)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white transition-colors"
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!window.confirm("确定删除此配额规则？")) return
                                await api.del(`/billing/quotas/${q.id}`)
                                refetch()
                              }}
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
            {grouped().length === 0 && <p class="py-8 text-center text-[var(--color-text-muted)]">暂无配额配置</p>}
          </div>
        </Card>
      )}

      <Show when={open()}>
        <div class="fixed inset-0 bg-[var(--color-bg-overlay)] z-[var(--z-overlay)]" onClick={close} />
      </Show>
      <div
        class="fixed right-0 top-0 bottom-0 w-[400px] z-[var(--z-modal)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-xl)] flex flex-col"
        style={{
          transform: open() ? "translateX(0)" : "translateX(100%)",
          transition: "transform 200ms ease-out",
        }}
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
            {panel()?.mode === "create" ? "新增配额" : "编辑配额"}
          </h2>
          <button class="p-1 rounded-[var(--radius-md)] hover:bg-[var(--color-muted)] text-[var(--color-text-muted)]" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {panel()?.mode === "create" ? (
            <>
              <div>
                <label class="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">范围类型</label>
                <select
                  class="w-full h-10 px-3 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                  value={form().scope_type}
                  onChange={(e) => setForm((f) => ({ ...f, scope_type: e.currentTarget.value }))}
                >
                  <option value="global">全局</option>
                  <option value="department">部门</option>
                  <option value="user">用户</option>
                </select>
              </div>
              <Input
                label="范围 ID"
                value={form().scope_id}
                placeholder="留空表示默认"
                onInput={(v) => setForm((f) => ({ ...f, scope_id: v }))}
              />
              <div>
                <label class="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">周期</label>
                <select
                  class="w-full h-10 px-3 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                  value={form().period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.currentTarget.value }))}
                >
                  <option value="daily">日</option>
                  <option value="monthly">月</option>
                </select>
              </div>
            </>
          ) : (
            <div class="space-y-1 text-sm text-[var(--color-text-secondary)]">
              <p>类型: {scopeLabel(form().scope_type)}</p>
              <p>ID: {form().scope_id || "(默认)"}</p>
              <p>周期: {periodLabel(form().period)}</p>
            </div>
          )}
          <Input
            label="最大 Token"
            type="number"
            value={form().max_tokens}
            onInput={(v) => setForm((f) => ({ ...f, max_tokens: v }))}
          />
        </div>

        <div class="px-5 py-4 border-t border-[var(--color-border)] flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={close}>取消</Button>
          <Button variant="primary" size="sm" onClick={save}>保存</Button>
        </div>
      </div>
    </div>
  )
}
