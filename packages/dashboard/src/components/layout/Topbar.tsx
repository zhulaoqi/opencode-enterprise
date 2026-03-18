import { createSignal } from "solid-js"
import { Search, Bell, Sun, Moon, LogOut, Settings } from "lucide-solid"
import { user, logout } from "../../stores/auth"
import { setTheme, resolved } from "../../stores/theme"
import { connected } from "../../lib/ws"

export function Topbar() {
  const [showUserMenu, setShowUserMenu] = createSignal(false)

  const toggleTheme = () => {
    const r = resolved()
    setTheme(r === "dark" ? "light" : "dark")
  }

  return (
    <header class="h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div class="flex items-center gap-3 flex-1 max-w-md">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
          <input
            type="search"
            placeholder="搜索..."
            class="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
          />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span
          class={`text-xs px-2 py-0.5 rounded ${connected() ? "bg-[var(--color-success-light)] text-[var(--color-success)]" : "bg-[var(--color-muted)] text-[var(--color-text-muted)]"}`}
        >
          {connected() ? "已连接" : "离线"}
        </span>
        <button
          class="p-2 rounded hover:bg-[var(--color-muted)]"
          onClick={toggleTheme}
          aria-label="切换主题"
        >
          {resolved() === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button class="p-2 rounded hover:bg-[var(--color-muted)] relative" aria-label="通知">
          <Bell size={18} />
        </button>
        <div class="relative">
          <button
            class="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--color-muted)]"
            onClick={() => setShowUserMenu((v) => !v)}
          >
            <div class="w-8 h-8 rounded-full bg-[var(--color-muted)] flex items-center justify-center text-sm font-medium">
              {user()?.name?.slice(0, 1) ?? "?"}
            </div>
          </button>
          {showUserMenu() && (
            <>
              <div
                class="fixed inset-0 z-[var(--z-dropdown)]"
                onClick={() => setShowUserMenu(false)}
              />
              <div class="absolute right-0 top-full mt-1 py-1 w-48 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] z-[var(--z-dropdown)]">
                <a
                  href="/settings"
                  class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings size={16} />
                  设置
                </a>
                <button
                  class="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--color-muted)] text-[var(--color-error)]"
                  onClick={() => {
                    setShowUserMenu(false)
                    logout()
                  }}
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
