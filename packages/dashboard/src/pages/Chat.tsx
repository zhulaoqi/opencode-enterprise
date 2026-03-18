import { onMount } from "solid-js"
import { SessionList } from "../components/chat/SessionList"
import { MessageList } from "../components/chat/MessageList"
import { ChatInput } from "../components/chat/ChatInput"
import { loadSessions, activeId } from "../stores/chat"
import { connect } from "../lib/ws"

export default function Chat() {
  onMount(() => {
    loadSessions()
    connect()
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
