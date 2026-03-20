import { onMount, createResource, Show, For } from "solid-js"
import { SessionList } from "../components/chat/SessionList"
import { MessageList } from "../components/chat/MessageList"
import { ChatInput } from "../components/chat/ChatInput"
import { loadSessions, activeId } from "../stores/chat"
import { api } from "../lib/api"

type McpItem = { id: string; name: string; authorized?: boolean }

const [mcps] = createResource(
  activeId,
  () => api.get<{ mcps: McpItem[] }>("/mcp/market").then((res) => (res.mcps ?? []).filter((m) => m.authorized)),
)

export default function Chat() {
  onMount(() => {
    loadSessions()
  })

  return (
    <div class="flex h-full">
      <div class="hidden md:block shrink-0">
        <SessionList />
      </div>
      <div class="flex-1 flex flex-col min-w-0">
        {activeId() ? (
          <>
            <MessageList />
            <Show when={mcps()?.length}>
              <div class="flex flex-wrap gap-1.5 px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                <For each={mcps()}>
                  {(m) => (
                    <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
                      {m.name}
                    </span>
                  )}
                </For>
              </div>
            </Show>
            <ChatInput />
          </>
        ) : (
          <div class="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
            <p class="text-center">
              选择左侧对话或点击「新对话」开始
              <br />
              <span class="text-sm">移动端请从底部导航进入</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
