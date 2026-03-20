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

const examples: Record<string, { config: string; name: string; display: string; desc: string; tags: string }> = {
  stdio: {
    config: JSON.stringify({ command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"], env: {} }, null, 2),
    name: "filesystem",
    display: "文件系统",
    desc: "通过 stdio 管道调用本地 MCP 进程，适用于 CLI 工具",
    tags: "filesystem,tool",
  },
  http: {
    config: JSON.stringify({ url: "https://mcp.example.com/api", headers: { Authorization: "Bearer sk-xxx" } }, null, 2),
    name: "remote-api",
    display: "远程 API",
    desc: "通过 HTTP 调用远程 MCP 服务，适用于云端部署的工具",
    tags: "api,remote",
  },
  sse: {
    config: JSON.stringify({ url: "https://mcp.example.com/sse", headers: {} }, null, 2),
    name: "realtime-sse",
    display: "实时 SSE 服务",
    desc: "通过 Server-Sent Events 连接 MCP，适用于需要流式响应的场景",
    tags: "streaming,realtime",
  },
}

const visLabels: Record<string, { label: string; hint: string }> = {
  PUBLIC: { label: "公开", hint: "所有用户自动可用" },
  SHARED: { label: "受限", hint: "需要申请或管理员授权后可用" },
  PRIVATE: { label: "私有", hint: "仅自己和指定成员可见" },
}

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
        <div class="space-y-4">
          {/* Type selector */}
          <div>
            <label class="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">连接类型</label>
            <div class="grid grid-cols-3 gap-2">
              <For each={["stdio", "http", "sse"]}>
                {(t) => (
                  <button
                    class={`py-2.5 px-3 rounded-lg border text-sm text-center transition-all ${form().type === t ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium shadow-sm" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"}`}
                    onClick={() => patch("type", t)}
                  >
                    <div class="font-mono font-medium">{t}</div>
                    <div class="text-[11px] mt-0.5 opacity-70">
                      {t === "stdio" ? "本地进程" : t === "http" ? "HTTP 远程" : "SSE 流式"}
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>

          <Input label="名称 *" value={form().name} onInput={(v) => patch("name", v)} placeholder="唯一标识，如: filesystem" helper="英文小写，用于系统内部引用" />
          <Input label="显示名称 *" value={form().display_name} onInput={(v) => patch("display_name", v)} placeholder="如: 文件系统工具" />
          <Input label="描述" value={form().description} onInput={(v) => patch("description", v)} placeholder="简要描述 MCP 的功能和用途" />

          {/* Visibility */}
          <div>
            <label class="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">可见性</label>
            <div class="grid grid-cols-3 gap-2">
              <For each={["PUBLIC", "SHARED", "PRIVATE"]}>
                {(v) => {
                  const info = visLabels[v]
                  return (
                    <button
                      class={`py-2 px-3 rounded-lg border text-sm text-center transition-all ${form().visibility === v ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium shadow-sm" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"}`}
                      onClick={() => patch("visibility", v)}
                    >
                      <div class="font-medium">{info.label}</div>
                      <div class="text-[11px] mt-0.5 opacity-70">{info.hint}</div>
                    </button>
                  )
                }}
              </For>
            </div>
          </div>

          {/* Config JSON */}
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-sm font-semibold text-[var(--color-text-primary)]">配置 (JSON)</label>
              <button
                class="text-xs text-[var(--color-primary)] hover:underline"
                onClick={() => {
                  const ex = examples[form().type]
                  if (ex) setForm((f) => ({ ...f, config: ex.config, name: f.name || ex.name, display_name: f.display_name || ex.display, description: f.description || ex.desc, tags: f.tags || ex.tags }))
                }}
              >
                填充示例
              </button>
            </div>
            <textarea
              class="w-full h-32 px-3 py-2 text-sm font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-blue-500/10 resize-y"
              value={form().config}
              onInput={(e) => patch("config", e.currentTarget.value)}
              placeholder={examples[form().type]?.config ?? '{"command": "..."}'}
            />
            <div class="mt-1.5 p-2.5 rounded-lg bg-[var(--color-muted)] text-xs text-[var(--color-text-muted)] space-y-1">
              <Show when={form().type === "stdio"}>
                <p><b class="text-[var(--color-text-secondary)]">stdio 配置项：</b></p>
                <p><code class="text-[var(--color-primary)]">command</code> — 要执行的命令（如 npx, node, python）</p>
                <p><code class="text-[var(--color-primary)]">args</code> — 命令参数数组</p>
                <p><code class="text-[var(--color-primary)]">env</code> — 环境变量（可选，如 API key）</p>
              </Show>
              <Show when={form().type === "http"}>
                <p><b class="text-[var(--color-text-secondary)]">http 配置项：</b></p>
                <p><code class="text-[var(--color-primary)]">url</code> — 远程 MCP 服务的 HTTP 端点</p>
                <p><code class="text-[var(--color-primary)]">headers</code> — 请求头（可选，用于传 Auth token）</p>
              </Show>
              <Show when={form().type === "sse"}>
                <p><b class="text-[var(--color-text-secondary)]">sse 配置项：</b></p>
                <p><code class="text-[var(--color-primary)]">url</code> — SSE 服务端点</p>
                <p><code class="text-[var(--color-primary)]">headers</code> — 请求头（可选）</p>
              </Show>
            </div>
          </div>

          <Input label="标签" value={form().tags} onInput={(v) => patch("tags", v)} placeholder="逗号分隔，如: ai,tool,code" helper="用于筛选和分类" />

          <div class="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowReg(false)}>取消</Button>
            <Button variant="accent" size="sm" loading={submitting()} onClick={submit}>提交</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

