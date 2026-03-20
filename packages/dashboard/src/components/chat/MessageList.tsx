import { For, createEffect, on } from "solid-js"
import { MessageBubble } from "./MessageBubble"
import { ToolCallCard } from "./ToolCallCard"
import { ReasoningBlock } from "./ReasoningBlock"
import { ApprovalCard } from "./ApprovalCard"
import { StreamingCursor } from "./StreamingCursor"
import { messages, streaming, isStreaming } from "../../stores/chat"
import type { Message } from "../../stores/chat"

function MsgRow(props: { msg: Message }) {
  const m = props.msg
  if (m.reasoning) return <ReasoningBlock text={m.reasoning} duration={undefined} />
  return <MessageBubble msg={m} />
}

export function MessageList() {
  let container: HTMLDivElement | undefined
  let anchor: HTMLDivElement | undefined

  function scroll() {
    anchor?.scrollIntoView({ behavior: "smooth", block: "end" })
  }

  createEffect(on([messages, streaming], scroll, { defer: true }))

  return (
    <div ref={container} class="flex-1 overflow-auto p-4">
      <div class="max-w-3xl mx-auto">
        <For each={messages()}>
          {(msg) => <MsgRow msg={msg} />}
        </For>
        {isStreaming() && streaming() && (
          <div class="flex justify-start mb-4">
            <div class="max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
              <p class="text-sm whitespace-pre-wrap break-words">
                {streaming()}
                <StreamingCursor />
              </p>
            </div>
          </div>
        )}
        <div ref={anchor} class="h-1" />
      </div>
    </div>
  )
}
