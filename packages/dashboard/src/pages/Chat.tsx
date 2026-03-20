import { onMount, createResource, Show, For } from "solid-js"
import { SessionList } from "../components/chat/SessionList"
import { MessageList } from "../components/chat/MessageList"
import { ChatInput } from "../components/chat/ChatInput"
import { loadSessions, activeId } from "../stores/chat"
import { api } from "../lib/api"
import { ready as connected } from "../lib/worker"
import { Loader } from "lucide-solid"

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
    <div class="flex h-full relative">
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
      <Show when={!connected()}>
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg)]/60 backdrop-blur-[2px]">
          <div class="flex flex-col items-center gap-3 p-6 rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-[var(--shadow-lg)]">
            <Loader size={24} class="animate-spin text-[var(--color-primary)]" />
            <p class="text-sm font-medium text-[var(--color-text-primary)]">正在启动工作区...</p>
            <p class="text-xs text-[var(--color-text-muted)]">首次加载可能需要几秒钟</p>
          </div>
        </div>
      </Show>
    </div>
  )
}
