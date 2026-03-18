import { createSignal } from "solid-js"
import { Search } from "lucide-solid"

type Tab = "all" | "PUBLIC" | "SHARED" | "PRIVATE"

type Props = {
  tab: Tab
  onTabChange: (t: Tab) => void
  search: string
  onSearchChange: (s: string) => void
  tags: string[]
  selectedTag: string
  onTagSelect: (t: string) => void
}

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "PUBLIC", label: "公开" },
  { id: "SHARED", label: "共享" },
  { id: "PRIVATE", label: "我的" },
]

export function McpFilter(props: Props) {
  return (
    <div class="flex flex-col gap-4 mb-4">
      <div class="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            class={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium ${props.tab === t.id ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"}`}
            onClick={() => props.onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div class="flex flex-wrap gap-2 items-center">
        <div class="relative flex-1 min-w-[200px]">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
          <input
            type="search"
            placeholder="搜索 MCP..."
            class="w-full h-9 pl-8 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"
            value={props.search}
            onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          />
        </div>
        {props.tags.length > 0 && (
          <div class="flex gap-1 flex-wrap">
            <button
              class={`px-2 py-1 rounded text-xs ${!props.selectedTag ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-muted)] hover:bg-[var(--color-border)]"}`}
              onClick={() => props.onTagSelect("")}
            >
              全部
            </button>
            {props.tags.map((t) => (
              <button
                class={`px-2 py-1 rounded text-xs ${props.selectedTag === t ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-muted)] hover:bg-[var(--color-border)]"}`}
                onClick={() => props.onTagSelect(props.selectedTag === t ? "" : t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
