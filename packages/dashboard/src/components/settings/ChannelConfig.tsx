import { createSignal, createResource, Show, For } from "solid-js"
import { api } from "../../lib/api"
import { notify } from "../../stores/notification"
import { Card } from "../ui/Card"
import { ChannelModal } from "./ChannelModal"
import { MessageSquare, Settings, Zap, ToggleLeft, ToggleRight } from "lucide-solid"

type Channel = {
  id?: string
  type: string
  enabled: boolean
  config: Record<string, unknown>
  settings: Record<string, unknown>
  last_event?: string
}

const CHANNELS = [
  {
    type: "feishu",
    name: "飞书 Bot",
    icon: "飞",
    color: "#3370ff",
    fields: [
      { key: "app_id", label: "App ID", required: true, hint: "飞书开放平台 → 凭证与基础信息" },
      { key: "app_secret", label: "App Secret", required: true, secret: true, hint: "飞书开放平台 → 凭证与基础信息" },
      { key: "verification_token", label: "Verification Token", hint: "事件与回调 → 加密策略", only: "webhook" },
      { key: "encrypt_key", label: "Encrypt Key", hint: "事件与回调 → 加密策略", only: "webhook" },
    ],
    toggles: [
      { key: "auto_register", label: "免登自动注册", hint: "未绑定用户 @Bot 时自动创建账号" },
    ],
    guide: { label: "飞书开放平台配置指引", url: "https://open.feishu.cn/document/home/introduction-to-custom-app-development/self-built-application-development-process" },
  },
  {
    type: "dingtalk",
    name: "钉钉 Bot",
    icon: "钉",
    color: "#0089ff",
    fields: [
      { key: "agent_id", label: "Agent ID", required: true },
      { key: "app_key", label: "App Key", required: true },
      { key: "app_secret", label: "App Secret", required: true, secret: true },
    ],
    toggles: [
      { key: "auto_register", label: "免登自动注册", hint: "未绑定用户发消息时自动创建账号" },
    ],
    guide: { label: "钉钉开放平台文档", url: "https://open.dingtalk.com/document/" },
  },
  {
    type: "wecom",
    name: "企业微信 Bot",
    icon: "企",
    color: "#07c160",
    fields: [
      { key: "corp_id", label: "Corp ID", required: true },
      { key: "agent_id", label: "Agent ID", required: true },
      { key: "secret", label: "Secret", required: true, secret: true },
      { key: "token", label: "Token", hint: "接收消息配置" },
      { key: "encoding_aes_key", label: "EncodingAESKey", hint: "接收消息配置" },
    ],
    toggles: [
      { key: "auto_register", label: "免登自动注册", hint: "未绑定用户发消息时自动创建账号" },
    ],
    guide: { label: "企业微信开发文档", url: "https://developer.work.weixin.qq.com/document/path/90556" },
  },
] as const

function base() {
  if (import.meta.env.DEV) return "http://localhost:3100"
  return window.location.origin
}

export function ChannelConfig() {
  const [ver, setVer] = createSignal(0)
  const [channels] = createResource(
    () => ver(),
    () => api.get<{ channels: Channel[] }>("/admin/channels").then((r) => r.channels).catch(() => []),
  )
  const [editing, setEditing] = createSignal<string | null>(null)
  const [saving, setSaving] = createSignal(false)
  const [testing, setTesting] = createSignal<string | null>(null)

  function find(type: string): Channel | undefined {
    return (channels() ?? []).find((c) => c.type === type)
  }

  function status(ch: Channel | undefined) {
    if (!ch?.id) return { label: "未配置", color: "bg-gray-300" }
    if (!ch.enabled) return { label: "已配置", color: "bg-yellow-400" }
    if (ch.last_event) {
      const diff = Date.now() - new Date(ch.last_event).getTime()
      if (diff < 5 * 60 * 1000) return { label: "运行中", color: "bg-green-500" }
    }
    return { label: "已启用", color: "bg-green-400" }
  }

  function lastEvent(ch: Channel | undefined) {
    if (!ch?.last_event) return null
    const d = new Date(ch.last_event)
    return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  async function save(type: string, config: Record<string, unknown>, settings: Record<string, unknown>) {
    setSaving(true)
    try {
      const ch = find(type)
      await api.put(`/admin/channels/${type}`, { enabled: ch?.enabled ?? true, config, settings })
      notify("success", "保存成功")
      setEditing(null)
      setVer((v) => v + 1)
    } catch {
      notify("error", "保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function toggle(type: string) {
    const ch = find(type)
    if (!ch?.id) return
    try {
      await api.put(`/admin/channels/${type}`, { enabled: !ch.enabled })
      setVer((v) => v + 1)
    } catch {
      notify("error", "操作失败")
    }
  }

  async function test(type: string) {
    setTesting(type)
    try {
      const res = await api.post<{ ok: boolean; message?: string; error?: string }>(`/admin/channels/${type}/test`, {})
      if (res.ok) notify("success", res.message ?? "连接成功")
      else notify("error", res.error ?? "连接失败")
    } catch {
      notify("error", "测试失败")
    } finally {
      setTesting(null)
    }
  }

  return (
    <div class="space-y-3">
      <For each={CHANNELS}>
        {(def) => {
          const ch = () => find(def.type)
          const st = () => status(ch())
          const evt = () => lastEvent(ch())
          const supported = def.type === "feishu"

          return (
            <>
              <div class="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-primary)]/30 transition-colors">
                {/* Icon */}
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: def.color }}
                >
                  {def.icon}
                </div>

                {/* Info */}
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-[var(--color-text-primary)]">{def.name}</span>
                    <span class={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full text-white ${st().color}`}>
                      {st().label}
                    </span>
                    <Show when={!supported}>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-text-muted)]">即将支持</span>
                    </Show>
                  </div>
                  <Show when={evt()}>
                    <div class="text-[11px] text-[var(--color-text-muted)] mt-0.5">最近消息: {evt()}</div>
                  </Show>
                </div>

                {/* Actions */}
                <div class="flex items-center gap-1.5 shrink-0">
                  <Show when={ch()?.id && supported}>
                    <button
                      onClick={() => test(def.type)}
                      disabled={testing() === def.type}
                      class="p-2 rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] disabled:opacity-50"
                      title="测试连接"
                    >
                      <Zap size={15} class={testing() === def.type ? "animate-pulse" : ""} />
                    </button>
                  </Show>
                  <button
                    onClick={() => setEditing(def.type)}
                    disabled={!supported}
                    class="p-2 rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] disabled:opacity-30"
                    title="配置"
                  >
                    <Settings size={15} />
                  </button>
                  <Show when={ch()?.id && supported}>
                    <button
                      onClick={() => toggle(def.type)}
                      class="p-2 rounded-lg hover:bg-[var(--color-muted)]"
                      title={ch()?.enabled ? "停用" : "启用"}
                    >
                      <Show when={ch()?.enabled} fallback={<ToggleLeft size={18} class="text-[var(--color-text-muted)]" />}>
                        <ToggleRight size={18} class="text-[var(--color-primary)]" />
                      </Show>
                    </button>
                  </Show>
                </div>
              </div>

              <ChannelModal
                open={editing() === def.type}
                onClose={() => setEditing(null)}
                onSave={(cfg, st) => save(def.type, cfg, st)}
                title={`配置 ${def.name}`}
                fields={[...def.fields]}
                toggles={[...def.toggles]}
                modes={
                  def.type === "feishu"
                    ? [
                        { key: "websocket", label: "WebSocket 长连接", hint: "无需公网地址，推荐", icon: "ws" as const },
                        { key: "webhook", label: "Webhook 回调", hint: "需要公网 URL（ngrok）", icon: "webhook" as const },
                      ]
                    : []
                }
                webhooks={
                  def.type === "feishu"
                    ? [
                        { label: "事件回调", url: `${base()}/api/im/feishu/webhook` },
                        { label: "卡片回调", url: `${base()}/api/im/feishu/card-action` },
                      ]
                    : []
                }
                guide={def.guide}
                initial={ch() ? { config: ch()!.config, settings: ch()!.settings } : undefined}
                loading={saving()}
              />
            </>
          )
        }}
      </For>
    </div>
  )
}
