import { onMount, createMemo, createSignal, Show, For } from "solid-js"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { Modal } from "../components/ui/Modal"
import { McpCard } from "../components/mcp/McpCard"
import { McpFilter } from "../components/mcp/McpFilter"
import { user } from "../stores/auth"
import { notify } from "../stores/notification"
import { api } from "../lib/api"
import {
  mcps,
  loading,
  error,
  loadMarket,
  filterByVisibility,
  filterByTag,
  filterBySearch,
} from "../stores/mcp"

type Tab = "all" | "PUBLIC" | "SHARED" | "PRIVATE"

const empty = () => ({
  name: "",
  display_name: "",
  description: "",
  type: "stdio" as string,
  visibility: "PUBLIC" as string,
  config: "",
  tags: "",
})

export default function McpMarket() {
  const [tab, setTab] = createSignal<Tab>("all")
  const [search, setSearch] = createSignal("")
  const [selectedTag, setSelectedTag] = createSignal("")
  const [showReg, setShowReg] = createSignal(false)
  const [form, setForm] = createSignal(empty())
  const [submitting, setSubmitting] = createSignal(false)

  onMount(() => loadMarket())

  const tags = createMemo(() => {
    const seen = new Set<string>()
    for (const m of mcps()) {
      for (const t of m.tags ?? []) seen.add(t)
    }
    return [...seen].sort()
  })

  const filtered = createMemo(() => {
    let items = filterByVisibility(mcps(), tab(), user()?.id)
    items = filterByTag(items, selectedTag())
    items = filterBySearch(items, search())
    return items
  })

  const patch = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    const f = form()
    if (!f.name.trim() || !f.display_name.trim()) return notify("warning", "名称为必填项")
    setSubmitting(true)
    const body: Record<string, unknown> = {
      name: f.name.trim(),
      display_name: f.display_name.trim(),
      description: f.description.trim() || undefined,
      type: f.type,
      visibility: f.visibility,
      tags: f.tags ? f.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    }
    if (f.config.trim()) body.config = JSON.parse(f.config)
    await api.post("/mcp", body)
    notify("success", "MCP 注册成功")
    setShowReg(false)
    setForm(empty())
    setSubmitting(false)
    loadMarket()
  }

  return (
    <div class="p-4 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">MCP 市场</h1>
        <Button variant="accent" size="sm" onClick={() => setShowReg(true)}>注册新 MCP</Button>
      </div>
      <McpFilter
        tab={tab()}
        onTabChange={setTab}
        search={search()}
        onSearchChange={setSearch}
        tags={tags()}
        selectedTag={selectedTag()}
        onTagSelect={setSelectedTag}
      />
      <Show when={loading()}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(() => (
            <Card>
              <Skeleton height={24} class="mb-2" />
              <Skeleton height={16} class="mb-2" />
              <Skeleton height={48} />
            </Card>
          ))}
        </div>
      </Show>
      <Show when={error()}>
        <p class="text-[var(--color-error)]">加载失败: {error()}</p>
      </Show>
      <Show when={!loading() && !error()}>
        <Show
          when={filtered().length}
          fallback={
            <div class="flex flex-col items-center justify-center py-20 text-[var(--color-text-muted)]">
              <p class="text-lg">暂无 MCP，点击上方按钮注册第一个</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={filtered()}>{(m) => <McpCard mcp={m} showAuth />}</For>
          </div>
        </Show>
      </Show>
      <Modal open={showReg()} onClose={() => setShowReg(false)} title="注册新 MCP" size="md">
        <div class="space-y-3">
          <Input label="名称 *" value={form().name} onInput={(v) => patch("name", v)} placeholder="唯一标识" />
          <Input label="显示名称 *" value={form().display_name} onInput={(v) => patch("display_name", v)} placeholder="展示用名称" />
          <Input label="描述" value={form().description} onInput={(v) => patch("description", v)} placeholder="简要描述" />
          <div>
            <label class="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">类型</label>
            <select
              class="w-full h-10 px-3 text-base rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]"
              value={form().type}
              onChange={(e) => patch("type", e.currentTarget.value)}
            >
              <option value="stdio">stdio</option>
              <option value="http">http</option>
              <option value="sse">sse</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">可见性</label>
            <select
              class="w-full h-10 px-3 text-base rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]"
              value={form().visibility}
              onChange={(e) => patch("visibility", e.currentTarget.value)}
            >
              <option value="PUBLIC">PUBLIC</option>
              <option value="SHARED">SHARED</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">配置 (JSON)</label>
            <textarea
              class="w-full h-24 px-3 py-2 text-sm font-mono rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] resize-y"
              value={form().config}
              onInput={(e) => patch("config", e.currentTarget.value)}
              placeholder='{"command": "..."}'
            />
          </div>
          <Input label="标签" value={form().tags} onInput={(v) => patch("tags", v)} placeholder="逗号分隔，如: ai,tool" />
          <div class="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowReg(false)}>取消</Button>
            <Button variant="accent" size="sm" loading={submitting()} onClick={submit}>提交</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

