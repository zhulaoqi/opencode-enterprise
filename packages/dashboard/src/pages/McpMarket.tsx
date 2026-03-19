import { onMount, createMemo, createSignal, For } from "solid-js"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Button } from "../components/ui/Button"
import { McpCard } from "../components/mcp/McpCard"
import { McpFilter } from "../components/mcp/McpFilter"
import { user } from "../stores/auth"
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

export default function McpMarket() {
  const [tab, setTab] = createSignal<Tab>("all")
  const [search, setSearch] = createSignal("")
  const [selectedTag, setSelectedTag] = createSignal("")

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

  return (
    <div class="p-4 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">MCP 市场</h1>
        <Button variant="accent" size="sm">注册新 MCP</Button>
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
      {loading() && (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(() => (
            <Card>
              <Skeleton height={24} class="mb-2" />
              <Skeleton height={16} class="mb-2" />
              <Skeleton height={48} />
            </Card>
          ))}
        </div>
      )}
      {error() && <p class="text-[var(--color-error)]">加载失败: {error()}</p>}
      {!loading() && !error() && (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={filtered()}>{(m) => <McpCard mcp={m} showAuth />}</For>
        </div>
      )}
    </div>
  )
}

