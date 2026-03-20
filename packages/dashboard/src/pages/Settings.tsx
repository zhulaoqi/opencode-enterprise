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
          <Show when={(user()?.roles?.length ?? 0) > 0}>
            <div class="mt-4 pt-3 border-t border-[var(--color-border)]">
              <div class="flex flex-wrap items-center gap-2">
                <For each={user()?.roles?.filter((r): r is RoleName => r in ROLES) ?? []}>
                  {(r) => (
                    <span class={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge(r)}`}>
                      <span class={`w-1.5 h-1.5 rounded-full ${ROLES[r].dot}`} />
                      {ROLES[r].label}
                    </span>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Show when={user()?.departments?.length || user()?.level}>
            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-[var(--color-border)]/50">
              <Show when={user()?.departments?.length}>
                <p class="text-xs text-[var(--color-text-muted)]">
                  <span class="font-medium text-[var(--color-text-secondary)]">部门</span>
                  <span class="ml-1.5">{user()!.departments!.join("、")}</span>
                </p>
              </Show>
              <Show when={user()?.level}>
                <p class="text-xs text-[var(--color-text-muted)]">
                  <span class="font-medium text-[var(--color-text-secondary)]">职级</span>
                  <span class="ml-1.5">{user()!.level}</span>
                </p>
              </Show>
            </div>
          </Show>
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
            class="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-error)] text-white hover:opacity-90 transition-colors"
            onClick={logout}
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
