import { createSignal, createResource, Show, For } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Button } from "../components/ui/Button"
import { notify } from "../stores/notification"

type Model = {
  id: string
  name: string
  model_id: string
  provider: string
  base_url: string
  api_key: string
  enabled: boolean
  sort_order: number
}

const PROVIDERS = [
  { value: "openai", label: "OpenAI", hint: "https://api.openai.com/v1" },
  { value: "openrouter", label: "OpenRouter", hint: "https://openrouter.ai/api/v1" },
  { value: "anthropic", label: "Anthropic", hint: "https://api.anthropic.com" },
  { value: "custom", label: "自定义兼容", hint: "填写你的 OpenAI 兼容端点" },
] as const

const blank = {
  name: "",
  model_id: "",
  provider: "openrouter",
  base_url: "",
  api_key: "",
  enabled: true,
}

const inp = "h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm w-full"

function mask(key: string) {
  if (!key || key.length < 6) return "***"
  return key.slice(0, 3) + "***" + key.slice(-3)
}

const provLabel: Record<string, string> = { openai: "OpenAI", openrouter: "OpenRouter", anthropic: "Anthropic", custom: "自定义" }

export default function Models() {
  const [ver, setVer] = createSignal(0)
  const [models] = createResource(
    () => ver(),
    () => api.get<{ models: Model[] }>("/models/admin").then((r) => r.models),
  )
  const [editing, setEditing] = createSignal<Model | null>(null)
  const [adding, setAdding] = createSignal(false)
  const [form, setForm] = createSignal({ ...blank })
  const [saving, setSaving] = createSignal(false)
  const [deleting, setDeleting] = createSignal<string | null>(null)
  const [dragIdx, setDragIdx] = createSignal(-1)
  const [overIdx, setOverIdx] = createSignal(-1)

  function field<K extends keyof typeof blank>(key: K, val: (typeof blank)[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function startAdd() {
    setEditing(null)
    setForm({ ...blank })
    setAdding(true)
  }

  function startEdit(m: Model) {
    setAdding(false)
    setForm({ name: m.name, model_id: m.model_id, provider: m.provider, base_url: m.base_url, api_key: "", enabled: m.enabled })
    setEditing(m)
  }

  function cancel() { setAdding(false); setEditing(null) }

  async function save() {
    setSaving(true)
    try {
      const ed = editing()
      if (ed) {
        const body: Record<string, unknown> = { ...form() }
        if (!body.api_key) delete body.api_key
        await api.put(`/models/admin/${ed.id}`, body)
        notify("success", "模型已更新")
      } else {
        await api.post("/models/admin", form())
        notify("success", "模型已添加")
      }
      cancel()
      setVer((v) => v + 1)
    } catch (e) {
      notify("error", String(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/models/admin/${id}`)
      notify("success", "模型已删除")
      setDeleting(null)
      setVer((v) => v + 1)
    } catch (e) {
      notify("error", String(e))
    }
  }

  async function onDrop(to: number) {
    const from = dragIdx()
    setDragIdx(-1)
    setOverIdx(-1)
    if (from < 0 || from === to) return
    const list = models()
    if (!list) return
    const reordered = [...list]
    const [item] = reordered.splice(from, 1)
    reordered.splice(to, 0, item)
    const updates = reordered.map((m, i) => ({ id: m.id, sort_order: i }))
    try {
      await api.put("/models/admin/reorder", { order: updates })
      setVer((v) => v + 1)
    } catch (e) {
      notify("error", "排序保存失败")
    }
  }

  const open = () => adding() || !!editing()

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">模型管理</h1>
        <Button onClick={startAdd} disabled={open()}>添加模型</Button>
      </div>

      <Show when={open()}>
        <Card>
          <div class="p-5 space-y-4">
            <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {editing() ? "编辑模型" : "添加模型"}
            </h2>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">显示名称</label>
                <input class={inp} placeholder="如 Claude Opus 4.6、GPT-4o Mini" value={form().name} onInput={(e) => field("name", e.currentTarget.value)} />
                <p class="text-[11px] text-[var(--color-text-muted)] mt-1">用户在聊天中看到的名称</p>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">模型标识</label>
                <input class={inp} placeholder="如 claude-opus-4-6、gpt-4o-mini" value={form().model_id} onInput={(e) => field("model_id", e.currentTarget.value)} />
                <p class="text-[11px] text-[var(--color-text-muted)] mt-1">API 调用时的模型名，需与供应商文档一致</p>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">供应商</label>
                <select class={inp} value={form().provider} onChange={(e) => {
                  const v = e.currentTarget.value
                  field("provider", v)
                  const p = PROVIDERS.find((x) => x.value === v)
                  if (p && !form().base_url) field("base_url", p.hint)
                }}>
                  <For each={PROVIDERS as unknown as { value: string; label: string }[]}>{(p) => <option value={p.value}>{p.label}</option>}</For>
                </select>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">Base URL</label>
                <input class={inp} value={form().base_url} placeholder={PROVIDERS.find((p) => p.value === form().provider)?.hint ?? ""} onInput={(e) => field("base_url", e.currentTarget.value)} />
              </div>
              <div class="col-span-2">
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">API Key</label>
                <input class={inp} type="password" placeholder={editing() ? "留空不修改" : "填写供应商提供的 API Key"} value={form().api_key} onInput={(e) => field("api_key", e.currentTarget.value)} />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <label class="text-sm text-[var(--color-text-primary)]">启用</label>
              <button
                class={`w-10 h-5 rounded-full transition-colors ${form().enabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                onClick={() => field("enabled", !form().enabled)}
              >
                <span class={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${form().enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div class="flex gap-2 pt-1">
              <Button onClick={save} loading={saving()}>保存</Button>
              <Button variant="ghost" onClick={cancel}>取消</Button>
            </div>
          </div>
        </Card>
        <div class="h-4" />
      </Show>

      <Show when={models.loading}>
        <Skeleton height={120} />
      </Show>
      <Show when={models.error}>
        <p class="text-[var(--color-error)]">加载失败: {String(models.error)}</p>
      </Show>
      <Show when={models()?.length === 0 && !models.loading}>
        <Card>
          <div class="py-12 text-center text-[var(--color-text-muted)]">
            <p class="text-lg mb-1">暂无模型</p>
            <p class="text-sm">点击「添加模型」配置你的第一个 AI 模型</p>
          </div>
        </Card>
      </Show>
      <Show when={(models()?.length ?? 0) > 0}>
        <div class="space-y-2">
          <Show when={(models()?.length ?? 0) > 1}>
            <p class="text-xs text-[var(--color-text-muted)] mb-1">拖拽卡片调整模型顺序，顶部模型为用户默认选项</p>
          </Show>
          <For each={models()}>
            {(m, idx) => (
              <div
                draggable={true}
                onDragStart={() => setDragIdx(idx())}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(idx()) }}
                onDragLeave={() => setOverIdx(-1)}
                onDrop={(e) => { e.preventDefault(); onDrop(idx()) }}
                onDragEnd={() => { setDragIdx(-1); setOverIdx(-1) }}
                class={`group rounded-xl border p-4 transition-all cursor-grab active:cursor-grabbing ${
                  overIdx() === idx() && dragIdx() !== idx()
                    ? "border-[var(--color-primary)] bg-blue-50/50 ring-1 ring-[var(--color-primary)]"
                    : dragIdx() === idx()
                      ? "opacity-40 border-dashed border-[var(--color-border)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-focus)]"
                }`}
              >
                <div class="flex items-center gap-4">
                  {/* Drag handle */}
                  <div class="flex flex-col gap-0.5 opacity-30 group-hover:opacity-60 transition-opacity shrink-0">
                    <div class="w-4 h-0.5 rounded bg-current" />
                    <div class="w-4 h-0.5 rounded bg-current" />
                    <div class="w-4 h-0.5 rounded bg-current" />
                  </div>

                  {/* Info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-semibold text-[var(--color-text-primary)] truncate">{m.name}</span>
                      <span class={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${m.enabled ? "bg-green-500/10 text-green-600" : "bg-[var(--color-muted)] text-[var(--color-text-muted)]"}`}>
                        {m.enabled ? "启用" : "禁用"}
                      </span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span class="font-mono">{m.model_id}</span>
                      <span class="opacity-40">·</span>
                      <span>{provLabel[m.provider] ?? m.provider}</span>
                      <span class="opacity-40">·</span>
                      <span class="truncate max-w-[200px]">{m.base_url || "-"}</span>
                      <span class="opacity-40">·</span>
                      <span class="font-mono">{mask(m.api_key)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(m)}>编辑</Button>
                    <Show when={deleting() === m.id} fallback={
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(m.id)}>删除</Button>
                    }>
                      <Button variant="danger" size="sm" onClick={() => remove(m.id)}>确认</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>取消</Button>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
