import { For, createSignal } from "solid-js"
import { Plus, Search } from "lucide-solid"
import { api } from "../../lib/api"
import type { Session } from "../../stores/chat"
import { sessions, setSessions, activeId, setActiveId, loadSessions, loadMessages } from "../../stores/chat"

export function SessionList() {
  const [q, setQ] = createSignal("")

  const filtered = () => {
    const s = q().toLowerCase()
    return s ? sessions().filter((x) => (x.title ?? "").toLowerCase().includes(s)) : sessions()
  }

  const handleNew = async () => {
    const row = await api.post<Session>("/sessions", { title: "新对话" })
    setSessions((prev) => [row, ...prev])
    setActiveId(row.id)
    loadMessages(row.id)
  }

  const handleSelect = (id: string) => {
    setActiveId(id)
    loadMessages(id)
  }

  return (
    <div class="w-70 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div class="p-2 flex gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-2 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
          onClick={handleNew}
        >
          <Plus size={18} />
          新对话
        </button>
      </div>
      <div class="px-2 pb-2">
        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
          <input
            type="search"
            placeholder="搜索对话..."
            class="w-full h-8 pl-8 pr-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"
            value={q()}
            onInput={(e) => setQ(e.currentTarget.value)}
          />
        </div>
      </div>
      <div class="flex-1 overflow-auto">
        <For each={filtered()}>
          {(s) => (
            <button
              class={`w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] mx-2 mb-1 hover:bg-[var(--color-muted)] ${activeId() === s.id ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium border-l-2 border-l-[var(--color-primary)]" : ""}`}
              onClick={() => handleSelect(s.id)}
            >
              <p class="truncate text-sm">{s.title ?? "新对话"}</p>
              <p class="text-xs text-[var(--color-text-muted)] truncate">
                {new Date(s.updated_at).toLocaleDateString("zh-CN")}
              </p>
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
