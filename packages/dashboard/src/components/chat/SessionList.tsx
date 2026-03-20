import { For, createSignal } from "solid-js"
import { Plus, Search, MoreVertical } from "lucide-solid"
import type { Session } from "../../stores/chat"
import { sessions, setSessions, activeId, setActiveId, loadSessions, loadMessages, createSession } from "../../stores/chat"
import { Dropdown } from "../ui/Dropdown"
import { notify } from "../../stores/notification"
import { ready as connected } from "../../lib/worker"

export function SessionList() {
  const [q, setQ] = createSignal("")
  const [editing, setEditing] = createSignal<string | null>(null)
  const [editTitle, setEditTitle] = createSignal("")

  const filtered = () => {
    const s = q().toLowerCase()
    return s ? sessions().filter((x) => x.title.toLowerCase().includes(s)) : sessions()
  }

  const handleNew = async () => {
    try {
      const id = await createSession()
      setActiveId(id)
      loadMessages(id)
    } catch (e) {
      notify("error", String(e))
    }
  }

  const handleSelect = (id: string) => {
    setActiveId(id)
    loadMessages(id)
  }

  const handleRename = (s: Session) => {
    setEditing(s.id)
    setEditTitle(s.title || "新对话")
  }

  const submitRename = async (id: string) => {
    const t = editTitle().trim()
    setEditing(null)
    if (!t) return
    setSessions((prev) => prev.map((x) => (x.id === id ? { ...x, title: t } : x)))
    notify("success", "已重命名")
  }

  const handleDelete = async (id: string) => {
    try {
      const { deleteSession } = await import("../../stores/chat")
      await deleteSession(id)
      notify("success", "已删除")
    } catch (e) {
      notify("error", String(e))
    }
  }

  return (
    <div class="w-70 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div class="p-2 flex gap-2">
        <button
          class={`flex-1 flex items-center justify-center gap-2 h-9 rounded-[var(--radius-md)] ${connected() ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]" : "bg-[var(--color-muted)] text-[var(--color-text-muted)] cursor-not-allowed"}`}
          onClick={handleNew}
          disabled={!connected()}
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
            <div
              class={`group flex items-center gap-1 px-3 py-2.5 rounded-[var(--radius-md)] mx-2 mb-1 hover:bg-[var(--color-muted)] ${activeId() === s.id ? "bg-[var(--color-primary-light)] border-l-2 border-l-[var(--color-primary)]" : ""}`}
            >
              {editing() === s.id ? (
                <input
                  type="text"
                  class="flex-1 min-w-0 h-7 px-2 rounded text-sm border border-[var(--color-border)] bg-[var(--color-bg)]"
                  value={editTitle()}
                  onInput={(e) => setEditTitle(e.currentTarget.value)}
                  onBlur={() => submitRename(s.id)}
                  onKeyDown={(e) => e.key === "Enter" && submitRename(s.id)}
                  autofocus
                />
              ) : (
                <button class="flex-1 min-w-0 text-left" onClick={() => handleSelect(s.id)}>
                  <p class={`truncate text-sm ${activeId() === s.id ? "text-[var(--color-primary)] font-medium" : ""}`}>
                    {s.title || "新对话"}
                  </p>
                  <p class="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                    {s.time?.updated ? new Date(s.time.updated).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "刚刚"}
                  </p>
                </button>
              )}
              <Dropdown
                trigger={({ onClick }) => (
                  <button
                    class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-border)] shrink-0"
                    onClick={onClick}
                    aria-label="操作"
                  >
                    <MoreVertical size={16} />
                  </button>
                )}
              >
                <button class="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-muted)]" onClick={() => handleRename(s)}>
                  重命名
                </button>
                <button
                  class="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-muted)] text-[var(--color-error)]"
                  onClick={() => handleDelete(s.id)}
                >
                  删除
                </button>
              </Dropdown>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
