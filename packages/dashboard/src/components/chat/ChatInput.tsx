import { createSignal, createResource, Show, For, createEffect } from "solid-js"
import { Send, Square, Sparkles, ChevronDown, Check } from "lucide-solid"
import { sendMessage, cancelStream, isStreaming } from "../../stores/chat"
import { api } from "../../lib/api"

type Model = { id: string; name: string; model_id: string; group?: string }

const [models] = createResource(() => api.get<{ models: Model[] }>("/models").then((r) => r.models ?? []))
export const [model, setModel] = createSignal("")

function ModelOption(props: { m: Model; active: boolean; onSelect: () => void }) {
  return (
    <button
      class={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${props.active ? "bg-blue-50 text-[var(--color-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-muted)]"}`}
      onClick={props.onSelect}
    >
      <Sparkles size={14} class={props.active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"} />
      <div class="flex-1 min-w-0">
        <div class="font-medium truncate">{props.m.name}</div>
        <Show when={props.m.model_id !== props.m.name}>
          <div class="text-[11px] text-[var(--color-text-muted)] font-mono truncate">{props.m.model_id}</div>
        </Show>
      </div>
      <Show when={props.active}>
        <Check size={14} class="text-[var(--color-primary)] shrink-0" />
      </Show>
    </button>
  )
}

export function ChatInput() {
  const [text, setText] = createSignal("")
  const [focused, setFocused] = createSignal(false)
  const [picker, setPicker] = createSignal(false)
  let ref: HTMLTextAreaElement | undefined

  createEffect(() => {
    const list = models()
    if (list?.length && !model()) setModel(list[0].id)
  })

  const resize = () => {
    if (!ref) return
    ref.style.height = "auto"
    ref.style.height = Math.min(ref.scrollHeight, 200) + "px"
  }

  const handleSubmit = () => {
    const t = text().trim()
    if (!t) return
    sendMessage(t, model() || undefined)
    setText("")
    if (ref) ref.style.height = "auto"
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const current = () => (models() ?? []).find((m) => m.id === model())
  const label = () => current()?.name ?? (model() || "选择模型")
  const canSend = () => text().trim().length > 0
  const list = () => models() ?? []
  const system = () => list().filter((m) => m.group === "system")
  const custom = () => list().filter((m) => m.group !== "system")

  return (
    <div class="px-4 pb-4 pt-2 bg-[var(--color-bg)]">
      <div class="max-w-3xl mx-auto">
        {/* Unified input container */}
        <div
          class="relative rounded-2xl border transition-all duration-200 overflow-visible"
          style={{
            background: "var(--color-bg-elevated)",
            "border-color": focused() ? "var(--color-border-focus)" : "var(--color-border)",
            "box-shadow": focused()
              ? "0 0 0 3px rgba(37,99,235,0.08), 0 2px 12px -2px rgba(0,0,0,0.06)"
              : "0 1px 6px -1px rgba(0,0,0,0.04)",
          }}
        >
          {/* Textarea */}
          <textarea
            ref={ref}
            class="w-full px-4 pt-3.5 pb-1 text-[15px] leading-relaxed bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus-visible:outline-none"
            placeholder="给 AI 发消息..."
            rows={1}
            value={text()}
            onInput={(e) => { setText(e.currentTarget.value); resize() }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={isStreaming()}
            style={{ "min-height": "48px", "max-height": "200px", outline: "none" }}
          />

          {/* Toolbar inside the box */}
          <div class="flex items-center justify-between px-2.5 pb-2.5 pt-0.5">
            {/* Left: model picker */}
            <div class="relative">
              <button
                class="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--color-muted)]"
                style={{ color: "var(--color-text-secondary)" }}
                onClick={() => setPicker((v) => !v)}
              >
                <Sparkles size={14} class="text-[var(--color-primary)] shrink-0" />
                <span class="max-w-[140px] truncate">{label()}</span>
                <ChevronDown size={12} class={`opacity-50 transition-transform ${picker() ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown */}
              <Show when={picker()}>
                <div class="fixed inset-0 z-[9]" onClick={() => setPicker(false)} />
                <div
                  class="absolute bottom-full left-0 mb-2 z-10 min-w-[240px] max-h-[320px] overflow-auto py-1 rounded-xl border bg-[var(--color-bg-elevated)] shadow-lg"
                  style={{ "border-color": "var(--color-border)" }}
                >
                  {/* System default */}
                  <Show when={system().length > 0}>
                    <div class="px-3 py-1.5 text-[11px] font-medium tracking-wider text-[var(--color-text-muted)]">
                      默认模型
                    </div>
                    <For each={system()}>
                      {(m) => <ModelOption m={m} active={m.id === model()} onSelect={() => { setModel(m.id); setPicker(false) }} />}
                    </For>
                  </Show>
                  {/* Custom models */}
                  <Show when={custom().length > 0}>
                    <Show when={system().length > 0}>
                      <div class="mx-2 my-1 border-t border-[var(--color-border)]" />
                    </Show>
                    <div class="px-3 py-1.5 text-[11px] font-medium tracking-wider text-[var(--color-text-muted)]">
                      自定义模型
                    </div>
                    <For each={custom()}>
                      {(m) => <ModelOption m={m} active={m.id === model()} onSelect={() => { setModel(m.id); setPicker(false) }} />}
                    </For>
                  </Show>
                  <Show when={list().length === 0}>
                    <div class="px-3 py-3 text-xs text-[var(--color-text-muted)] text-center">
                      暂无可用模型，请联系管理员配置
                    </div>
                  </Show>
                </div>
              </Show>
            </div>

            {/* Right: send / stop */}
            <button
              class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
              style={{
                background: isStreaming()
                  ? "var(--color-text-secondary)"
                  : canSend()
                    ? "var(--color-primary)"
                    : "var(--color-muted)",
                color: isStreaming() || canSend() ? "#fff" : "var(--color-text-muted)",
                cursor: !canSend() && !isStreaming() ? "default" : "pointer",
              }}
              onClick={() => (isStreaming() ? cancelStream() : handleSubmit())}
              disabled={!canSend() && !isStreaming()}
              title={isStreaming() ? "停止生成 (Esc)" : "发送消息 (Enter)"}
            >
              <Show when={isStreaming()} fallback={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 12L3 2l18 10-18 10 3-10z" fill="currentColor" stroke="none" />
                </svg>
              }>
                <Square size={14} fill="currentColor" />
              </Show>
            </button>
          </div>
        </div>

        {/* Footer hint */}
        <p class="text-center text-[11px] text-[var(--color-text-muted)] mt-2.5 select-none" style={{ opacity: 0.5 }}>
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  )
}
