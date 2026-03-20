import { createSignal, createEffect, onCleanup, Show, For } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { user } from "../stores/auth"
import { RefreshCw, StopCircle, RotateCw, Search } from "lucide-solid"

type WorkerMetrics = {
  cpu: number
  rss: number
  heap: number
  sessions: number
  tokens: { input: number; output: number }
  ts: number
}

type WorkerEntry = {
  uid: string
  name: string
  email: string
  avatar: string
  port: number
  pid: number
  status: "healthy" | "unhealthy" | "offline"
  started: number
  active: number
  metrics: WorkerMetrics | null
}

const REFRESH = 10_000

function ago(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return "刚刚"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function cpuColor(v: number): string {
  if (v > 80) return "text-red-600"
  if (v > 50) return "text-amber-600"
  return "text-emerald-600"
}

function memColor(v: number): string {
  if (v > 512) return "text-red-600"
  if (v > 256) return "text-amber-600"
  return "text-emerald-600"
}

function badge(s: string) {
  if (s === "healthy") return { text: "运行中", cls: "bg-emerald-500/10 text-emerald-600" }
  if (s === "unhealthy") return { text: "异常", cls: "bg-red-500/10 text-red-600" }
  return { text: "离线", cls: "bg-gray-500/10 text-gray-500" }
}

function admin() {
  return user()?.roles?.includes("admin") ?? false
}

export default function Workers() {
  const [workers, setWorkers] = createSignal<WorkerEntry[]>([])
  const [loading, setLoading] = createSignal(false)
  const [search, setSearch] = createSignal("")
  const [confirm, setConfirm] = createSignal<{ uid: string; action: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api.get<WorkerEntry[]>("/admin/workers")
      setWorkers(data)
    } catch (e) {
      console.error("[workers] load failed:", e)
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    load()
    const id = setInterval(load, REFRESH)
    onCleanup(() => clearInterval(id))
  })

  async function act(uid: string, action: string) {
    setConfirm(null)
    try {
      if (action === "restart") await api.post(`/admin/workers/${uid}/restart`, {})
      if (action === "stop") await api.post(`/admin/workers/${uid}/stop`, {})
      await load()
    } catch (e) {
      console.error(`[workers] ${action} failed:`, e)
    }
  }

  const filtered = () => {
    const q = search().toLowerCase()
    if (!q) return workers()
    return workers().filter((w) => w.name.toLowerCase().includes(q) || w.email.toLowerCase().includes(q))
  }

  const online = () => workers().filter((w) => w.status === "healthy").length
  const offline = () => workers().filter((w) => w.status !== "healthy").length
  const totalMem = () => workers().reduce((sum, w) => sum + (w.metrics?.rss ?? 0), 0)
  const totalTokens = () =>
    workers().reduce((sum, w) => sum + (w.metrics?.tokens.input ?? 0) + (w.metrics?.tokens.output ?? 0), 0)

  return (
    <div class="p-4 max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">节点管理</h1>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"
          onClick={load}
        >
          <RefreshCw size={14} class={loading() ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <p class="text-xs text-[var(--color-text-muted)]">在线节点</p>
          <p class="text-2xl font-bold text-emerald-600">{online()}</p>
        </Card>
        <Card>
          <p class="text-xs text-[var(--color-text-muted)]">离线/异常</p>
          <p class="text-2xl font-bold text-red-600">{offline()}</p>
        </Card>
        <Card>
          <p class="text-xs text-[var(--color-text-muted)]">总内存</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">{totalMem()} MB</p>
        </Card>
        <Card>
          <p class="text-xs text-[var(--color-text-muted)]">总 Token</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">{fmt(totalTokens())}</p>
        </Card>
      </div>

      <div class="relative mb-4">
        <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="搜索用户名或邮箱..."
          class="w-full pl-9 pr-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
      </div>

      <div class="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table class="w-full text-sm">
          <thead class="bg-[var(--color-muted)]">
            <tr class="text-left text-[var(--color-text-muted)]">
              <th class="px-4 py-3 font-medium">用户</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">CPU%</th>
              <th class="px-4 py-3 font-medium">内存</th>
              <th class="px-4 py-3 font-medium">会话</th>
              <th class="px-4 py-3 font-medium">Token</th>
              <th class="px-4 py-3 font-medium">启动时间</th>
              <th class="px-4 py-3 font-medium">最近活跃</th>
              <Show when={admin()}>
                <th class="px-4 py-3 font-medium">操作</th>
              </Show>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--color-border)]">
            <For each={filtered()} fallback={
              <tr><td colspan="9" class="px-4 py-8 text-center text-[var(--color-text-muted)]">暂无节点</td></tr>
            }>
              {(w) => {
                const s = badge(w.status)
                return (
                  <tr class="hover:bg-[var(--color-muted)]/50">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-xs font-medium text-[var(--color-primary)]">
                          {w.name.charAt(0)}
                        </div>
                        <div>
                          <p class="font-medium text-[var(--color-text-primary)]">{w.name}</p>
                          <p class="text-xs text-[var(--color-text-muted)]">{w.email}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
                        <span class={`w-1.5 h-1.5 rounded-full ${w.status === "healthy" ? "bg-emerald-500" : w.status === "unhealthy" ? "bg-red-500" : "bg-gray-400"}`} />
                        {s.text}
                      </span>
                    </td>
                    <td class={`px-4 py-3 font-mono ${cpuColor(w.metrics?.cpu ?? 0)}`}>
                      {w.metrics?.cpu?.toFixed(1) ?? "-"}%
                    </td>
                    <td class={`px-4 py-3 font-mono ${memColor(w.metrics?.rss ?? 0)}`}>
                      {w.metrics?.rss ?? "-"} MB
                    </td>
                    <td class="px-4 py-3 font-mono">
                      {w.metrics?.sessions ?? "-"}
                    </td>
                    <td class="px-4 py-3 font-mono text-[var(--color-text-secondary)]">
                      {w.metrics ? fmt((w.metrics.tokens.input ?? 0) + (w.metrics.tokens.output ?? 0)) : "-"}
                    </td>
                    <td class="px-4 py-3 text-[var(--color-text-muted)]">{ago(w.started)}</td>
                    <td class="px-4 py-3 text-[var(--color-text-muted)]">{ago(w.active)}</td>
                    <Show when={admin()}>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-1">
                          <Show when={w.status === "healthy" || w.status === "unhealthy"}>
                            <button
                              class="p-1.5 rounded hover:bg-amber-500/10 text-amber-600"
                              title="重启"
                              onClick={() => setConfirm({ uid: w.uid, action: "restart" })}
                            >
                              <RotateCw size={14} />
                            </button>
                            <button
                              class="p-1.5 rounded hover:bg-red-500/10 text-red-600"
                              title="停止"
                              onClick={() => setConfirm({ uid: w.uid, action: "stop" })}
                            >
                              <StopCircle size={14} />
                            </button>
                          </Show>
                        </div>
                      </td>
                    </Show>
                  </tr>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={confirm()}>
        {(c) => (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div class="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-6 shadow-lg max-w-sm w-full mx-4">
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                确认{c().action === "restart" ? "重启" : "停止"}
              </h3>
              <p class="text-sm text-[var(--color-text-secondary)] mb-4">
                确定要{c().action === "restart" ? "重启" : "停止"}此 Worker 节点吗？{c().action === "stop" ? "停止后用户将无法使用 AI 对话。" : "重启期间用户将短暂中断。"}
              </p>
              <div class="flex justify-end gap-2">
                <button
                  class="px-4 py-2 rounded-[var(--radius-md)] text-sm bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                  onClick={() => setConfirm(null)}
                >
                  取消
                </button>
                <button
                  class={`px-4 py-2 rounded-[var(--radius-md)] text-sm text-white ${c().action === "restart" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}`}
                  onClick={() => act(c().uid, c().action)}
                >
                  {c().action === "restart" ? "重启" : "停止"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
