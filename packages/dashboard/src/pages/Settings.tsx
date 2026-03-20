import { Show, For } from "solid-js"
import { theme, setTheme, resolved } from "../stores/theme"
import { user, logout } from "../stores/auth"
import { Avatar } from "../components/ui/Avatar"
import { Card } from "../components/ui/Card"
import { ChannelConfig } from "../components/settings/ChannelConfig"
import { ROLES, badge as roleBadge, type RoleName } from "../lib/roles"

function isAdmin() {
  const u = user()
  return u?.roles?.includes("admin")
}

export default function Settings() {
  return (
    <div class="p-4 max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">设置</h1>
      <div class="space-y-6">
        {/* Profile */}
        <Card>
          <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">个人资料</h2>
          <div class="flex items-center gap-4">
            <Avatar name={user()?.name} src={user()?.avatar} size="lg" />
            <div>
              <p class="font-medium text-[var(--color-text-primary)]">{user()?.name ?? "-"}</p>
              <p class="text-sm text-[var(--color-text-muted)]">{user()?.email ?? "-"}</p>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-[var(--color-border)]">
            <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-2">我的角色</h3>
            <div class="flex flex-wrap gap-2">
              <For each={user()?.roles?.filter((r): r is RoleName => r in ROLES) ?? []}>
                {(r) => (
                  <div class={`px-2.5 py-1.5 rounded-[var(--radius-md)] border text-xs ${roleBadge(r)}`}>
                    <span class="font-medium">{ROLES[r].label}</span>
                    <span class="ml-1.5 opacity-70">{ROLES[r].desc}</span>
                  </div>
                )}
              </For>
            </div>
            <Show when={user()?.departments?.length}>
              <p class="text-xs text-[var(--color-text-muted)] mt-2">
                部门：{user()!.departments!.join(", ")}
              </p>
            </Show>
            <Show when={user()?.level}>
              <p class="text-xs text-[var(--color-text-muted)] mt-1">
                职级：{user()!.level}
              </p>
            </Show>
          </div>
        </Card>

        {/* Appearance */}
        <div>
          <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">外观</h2>
          <div class="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                class={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium ${theme() === t ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"}`}
                onClick={() => setTheme(t)}
              >
                {t === "light" ? "浅色" : t === "dark" ? "深色" : "跟随系统"}
              </button>
            ))}
          </div>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">
            当前: {resolved() === "dark" ? "深色" : "浅色"}
          </p>
        </div>

        {/* External channels (admin only) */}
        <Show when={isAdmin()}>
          <div class="pt-4 border-t border-[var(--color-border)]">
            <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-1">外部消息渠道</h2>
            <p class="text-xs text-[var(--color-text-muted)] mb-4">配置飞书、钉钉、企业微信等 IM Bot，用户可在 IM 中直接与 AI 对话</p>
            <ChannelConfig />
          </div>
        </Show>

        {/* Logout */}
        <div class="pt-4 border-t border-[var(--color-border)]">
          <button
            class="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            onClick={logout}
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
