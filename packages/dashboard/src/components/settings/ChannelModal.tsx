import { createSignal, Show, For } from "solid-js"
import { Portal } from "solid-js/web"
import { X, Copy, Check, ExternalLink, Wifi, Globe } from "lucide-solid"

type Field = { key: string; label: string; required?: boolean; secret?: boolean; hint?: string; only?: string }
type Toggle = { key: string; label: string; hint?: string }

type Props = {
  open: boolean
  onClose: () => void
  onSave: (config: Record<string, unknown>, settings: Record<string, unknown>) => void
  title: string
  fields: Field[]
  toggles?: Toggle[]
  webhooks?: { label: string; url: string }[]
  modes?: { key: string; label: string; hint: string; icon: "ws" | "webhook" }[]
  guide?: { label: string; url: string }
  initial?: { config?: Record<string, unknown>; settings?: Record<string, unknown> }
  loading?: boolean
}

export function ChannelModal(props: Props) {
  const [form, setForm] = createSignal<Record<string, string>>({})
  const [toggles, setToggles] = createSignal<Record<string, boolean>>({})
  const [mode, setMode] = createSignal("websocket")
  const [copied, setCopied] = createSignal("")

  const init = () => {
    const cfg = (props.initial?.config ?? {}) as Record<string, string>
    const st = (props.initial?.settings ?? {}) as Record<string, unknown>
    setForm({ ...cfg })
    setMode((st.mode as string) ?? "websocket")
    const tg: Record<string, boolean> = {}
    for (const t of props.toggles ?? []) tg[t.key] = (st as Record<string, boolean>)[t.key] !== false
    setToggles(tg)
  }

  const onOpen = () => { if (props.open) init() }
  onOpen()

  function field(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function toggle(key: string) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function save() {
    props.onSave(form(), { ...toggles(), mode: mode() })
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(""), 2000)
  }

  const inp = "w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ "z-index": "var(--z-modal)" }} onClick={() => props.onClose()}>
          <div
            class="w-full max-w-lg mx-4 rounded-2xl bg-[var(--color-bg-elevated)] shadow-2xl border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">{props.title}</h3>
              <button onClick={() => props.onClose()} class="p-1 rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-text-muted)]">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div class="px-6 py-5 space-y-4 max-h-[60vh] overflow-auto">
              {/* Mode selector */}
              <Show when={(props.modes ?? []).length > 0}>
                <div>
                  <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-2">接入模式</label>
                  <div class="grid grid-cols-2 gap-2">
                    <For each={props.modes}>
                      {(m) => (
                        <button
                          class={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${mode() === m.key ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-[var(--color-border)] hover:bg-[var(--color-muted)]"}`}
                          onClick={() => setMode(m.key)}
                        >
                          <div class={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${mode() === m.key ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "bg-[var(--color-muted)] text-[var(--color-text-muted)]"}`}>
                            {m.icon === "ws" ? <Wifi size={16} /> : <Globe size={16} />}
                          </div>
                          <div class="min-w-0">
                            <div class={`text-sm font-medium ${mode() === m.key ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"}`}>{m.label}</div>
                            <div class="text-[11px] text-[var(--color-text-muted)] leading-tight">{m.hint}</div>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                  <Show when={mode() === "websocket"}>
                    <p class="mt-2 text-[11px] text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg">
                      推荐：无需公网地址，服务端主动连接飞书，开箱即用
                    </p>
                  </Show>
                </div>
              </Show>

              <For each={props.fields.filter((f) => !f.only || f.only === mode())}>
                {(f) => (
                  <div>
                    <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                      {f.label}
                      <Show when={f.required}><span class="text-red-500 ml-0.5">*</span></Show>
                    </label>
                    <input
                      class={inp}
                      type={f.secret ? "password" : "text"}
                      value={form()[f.key] ?? ""}
                      placeholder={f.hint}
                      onInput={(e) => field(f.key, e.currentTarget.value)}
                    />
                  </div>
                )}
              </For>

              <Show when={(props.toggles ?? []).length > 0}>
                <div class="pt-2 space-y-3">
                  <For each={props.toggles}>
                    {(t) => (
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="text-sm font-medium text-[var(--color-text-primary)]">{t.label}</div>
                          <Show when={t.hint}>
                            <div class="text-[11px] text-[var(--color-text-muted)]">{t.hint}</div>
                          </Show>
                        </div>
                        <button
                          class={`relative w-10 h-5 rounded-full transition-colors ${toggles()[t.key] ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                          onClick={() => toggle(t.key)}
                        >
                          <span class={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${toggles()[t.key] ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={(props.webhooks ?? []).length > 0 && mode() === "webhook"}>
                <div class="pt-3 border-t border-[var(--color-border)] space-y-2">
                  <div class="text-xs font-medium text-[var(--color-text-muted)] mb-2">Webhook 地址（复制到飞书后台 → 事件与回调）</div>
                  <For each={props.webhooks}>
                    {(w) => (
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-[var(--color-text-muted)] shrink-0 w-24">{w.label}</span>
                        <code class="flex-1 text-xs font-mono px-2 py-1.5 rounded bg-[var(--color-muted)] text-[var(--color-text-secondary)] truncate">{w.url}</code>
                        <button
                          onClick={() => copy(w.url, w.label)}
                          class="p-1.5 rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-text-muted)]"
                          title="复制"
                        >
                          <Show when={copied() === w.label} fallback={<Copy size={14} />}>
                            <Check size={14} class="text-green-500" />
                          </Show>
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={props.guide}>
                <div class="pt-2">
                  <a
                    href={props.guide!.url}
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                  >
                    <ExternalLink size={12} />
                    {props.guide!.label}
                  </a>
                </div>
              </Show>
            </div>

            {/* Footer */}
            <div class="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => props.onClose()}
                class="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"
              >
                取消
              </button>
              <button
                onClick={save}
                disabled={props.loading}
                class="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {props.loading ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
