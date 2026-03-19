import { createSignal, createResource, Show, For } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Table, TableHead, TableBody, TableRow, TableCell } from "../components/ui/Table"
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

const PROVIDERS = ["openai", "anthropic", "custom"] as const

const blank: Omit<Model, "id"> = {
  name: "",
  model_id: "",
  provider: "openai",
  base_url: "",
  api_key: "",
  enabled: true,
  sort_order: 0,
}

const input = "h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm w-full"

function mask(key: string) {
  if (!key || key.length < 6) return "***"
  return key.slice(0, 3) + "***..." + key.slice(-3)
}

export default function Models() {
  const [ver, setVer] = createSignal(0)
  const [models, { refetch }] = createResource(
    () => ver(),
    () => api.get<{ models: Model[] }>("/models/admin").then((r) => r.models),
  )
  const [editing, setEditing] = createSignal<Model | null>(null)
  const [adding, setAdding] = createSignal(false)
  const [form, setForm] = createSignal({ ...blank })
  const [saving, setSaving] = createSignal(false)
  const [deleting, setDeleting] = createSignal<string | null>(null)

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
    setForm({ name: m.name, model_id: m.model_id, provider: m.provider, base_url: m.base_url, api_key: "", enabled: m.enabled, sort_order: m.sort_order })
    setEditing(m)
  }

  function cancel() {
    setAdding(false)
    setEditing(null)
  }

  async function save() {
    setSaving(true)
    try {
      const ed = editing()
      if (ed) {
        const body = { ...form() }
        if (!body.api_key) delete (body as Record<string, unknown>).api_key
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

  const open = () => adding() || !!editing()

  return (
    <div class="p-4 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">模型管理</h1>
        <Button onClick={startAdd} disabled={open()}>添加模型</Button>
      </div>

      <Show when={open()}>
        <Card>
          <div class="p-4 space-y-3">
            <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {editing() ? "编辑模型" : "添加模型"}
            </h2>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">名称</label>
                <input class={input} value={form().name} onInput={(e) => field("name", e.currentTarget.value)} />
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">Model ID</label>
                <input class={input} value={form().model_id} onInput={(e) => field("model_id", e.currentTarget.value)} />
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">Provider</label>
                <select class={input} value={form().provider} onChange={(e) => field("provider", e.currentTarget.value)}>
                  <For each={PROVIDERS as unknown as string[]}>{(p) => <option value={p}>{p}</option>}</For>
                </select>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">Base URL</label>
                <input class={input} value={form().base_url} onInput={(e) => field("base_url", e.currentTarget.value)} />
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">API Key</label>
                <input class={input} type="password" placeholder={editing() ? "留空不修改" : ""} value={form().api_key} onInput={(e) => field("api_key", e.currentTarget.value)} />
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">排序</label>
                <input class={input} type="number" value={form().sort_order} onInput={(e) => field("sort_order", Number(e.currentTarget.value))} />
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
            <div class="flex gap-2 pt-2">
              <Button onClick={save} loading={saving()}>保存</Button>
              <Button variant="ghost" onClick={cancel}>取消</Button>
            </div>
          </div>
        </Card>
        <div class="h-4" />
      </Show>

      <Show when={models.loading}>
        <Skeleton height={200} />
      </Show>
      <Show when={models.error}>
        <p class="text-[var(--color-error)]">加载失败: {String(models.error)}</p>
      </Show>
      <Show when={models()}>
        <Card>
          <Table>
            <TableHead>
              <TableRow head>
                <TableCell head>名称</TableCell>
                <TableCell head>Model ID</TableCell>
                <TableCell head>Provider</TableCell>
                <TableCell head>Base URL</TableCell>
                <TableCell head>API Key</TableCell>
                <TableCell head>状态</TableCell>
                <TableCell head>排序</TableCell>
                <TableCell head align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <For each={models()}>
                {(m) => (
                  <TableRow>
                    <TableCell>{m.name}</TableCell>
                    <TableCell><span class="font-mono text-xs">{m.model_id}</span></TableCell>
                    <TableCell>{m.provider}</TableCell>
                    <TableCell><span class="text-xs truncate max-w-[160px] inline-block">{m.base_url || "-"}</span></TableCell>
                    <TableCell><span class="font-mono text-xs">{mask(m.api_key)}</span></TableCell>
                    <TableCell>
                      <span class={`text-xs px-2 py-0.5 rounded-full ${m.enabled ? "bg-green-500/10 text-green-600" : "bg-[var(--color-muted)] text-[var(--color-text-muted)]"}`}>
                        {m.enabled ? "启用" : "禁用"}
                      </span>
                    </TableCell>
                    <TableCell>{m.sort_order}</TableCell>
                    <TableCell align="right">
                      <div class="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(m)}>编辑</Button>
                        <Show when={deleting() === m.id} fallback={
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(m.id)}>删除</Button>
                        }>
                          <Button variant="danger" size="sm" onClick={() => remove(m.id)}>确认删除</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>取消</Button>
                        </Show>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </Card>
      </Show>
    </div>
  )
}
