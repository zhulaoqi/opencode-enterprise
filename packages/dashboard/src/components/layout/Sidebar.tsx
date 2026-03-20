import { A } from "@solidjs/router"
import { MessageSquare, Package, BarChart3, Users, Settings, ChevronLeft, ChevronRight, PieChart, FileText, FolderOpen, Cpu, Wifi, WifiOff, Loader, Server } from "lucide-solid"
import { createSignal, Show } from "solid-js"
import { user } from "../../stores/auth"
import { status } from "../../lib/worker"
import { ROLES, primary, badge as roleBadge } from "../../lib/roles"

type NavItem = {
  href: string
  label: string
  icon: typeof MessageSquare
  roles?: string[]
}

const main: NavItem[] = [
  { href: "/", label: "对话", icon: MessageSquare },
  { href: "/mcp", label: "MCP 市场", icon: Package },
  { href: "/dashboard", label: "仪表盘", icon: BarChart3, roles: ["admin", "manager"] },
  { href: "/admin/users", label: "用户管理", icon: Users, roles: ["admin", "manager"] },
  { href: "/admin/quotas", label: "配额管理", icon: PieChart, roles: ["admin", "manager"] },
  { href: "/admin/audit", label: "审计日志", icon: FileText, roles: ["admin", "manager"] },
  { href: "/admin/models", label: "模型管理", icon: Cpu, roles: ["admin"] },
  { href: "/admin/workers", label: "节点管理", icon: Server, roles: ["admin", "manager"] },
  { href: "/settings", label: "配置", icon: Settings },
]

const workspace: NavItem[] = [
  { href: "/mcp?tab=PRIVATE", label: "私有 MCP", icon: Package },
  { href: "/admin/quotas?scope=user", label: "我的配额", icon: PieChart },
]

function hasAccess(item: NavItem): boolean {
  if (!item.roles) return true
  const roles = user()?.roles ?? []
  return item.roles.some((r) => roles.includes(r))
}

export function Sidebar() {
  const [collapsed, setCollapsed] = createSignal(false)
  const [wsOpen, setWsOpen] = createSignal(true)
  const w = () => (collapsed() ? "w-16" : "w-60")

  const link = (item: NavItem) => (
    <A
      href={item.href}
      class="relative flex items-center gap-3 px-3 py-2 mx-2 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)] data-[active]:bg-[var(--color-primary-light)] data-[active]:text-[var(--color-primary)] data-[active]:font-semibold data-[active]:border-l-[3px] data-[active]:border-l-[var(--color-primary)]"
      activeClass="!bg-[var(--color-primary-light)] !text-[var(--color-primary)] font-semibold border-l-[3px] border-l-[var(--color-primary)]"
      end={item.href === "/"}
      title={collapsed() ? item.label : undefined}
    >
      <item.icon size={20} class="shrink-0" />
      {!collapsed() && <span>{item.label}</span>}
    </A>
  )

  return (
    <aside
      class={`${w()} hidden md:flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] transition-all duration-200 shrink-0`}
    >
      <div class="h-14 flex items-center justify-between px-3 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-2.5 min-w-0">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
            <rect width="48" height="48" rx="14" fill="url(#sg)" />
            <path d="M18 16l-6 8 6 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M30 16l6 8-6 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M27 14l-6 20" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7" />
            <defs><linearGradient id="sg" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#3b82f6" /><stop offset="1" stop-color="#1d4ed8" /></linearGradient></defs>
          </svg>
          {!collapsed() && <span class="font-bold text-[15px] text-[var(--color-text-primary)] tracking-tight">OpenCode</span>}
        </div>
        <button
          class="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--color-muted)] text-[var(--color-text-muted)]"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed() ? "展开" : "折叠"}
        >
          {collapsed() ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav class="flex-1 py-2 overflow-y-auto" aria-label="主导航">
        {main.filter(hasAccess).map(link)}
        <Show when={!collapsed()}>
          <div class="my-2 mx-3 border-t border-[var(--color-border)]" />
          <button
            class="flex items-center gap-3 px-3 py-2 mx-2 w-[calc(100%-16px)] text-left rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] text-sm"
            onClick={() => setWsOpen((v) => !v)}
          >
            <FolderOpen size={16} class="shrink-0" />
            <span>{wsOpen() ? "▾" : "▸"} 我的空间</span>
          </button>
          <Show when={wsOpen()}>
            {workspace.map(link)}
          </Show>
        </Show>
      </nav>
      <div class="p-3 border-t border-[var(--color-border)]">
        {collapsed() ? (
          <div class="flex justify-center" title={status() === "ready" ? "已就绪" : status() === "connecting" ? "连接中" : "离线"}>
            <div class={`w-2.5 h-2.5 rounded-full ${status() === "ready" ? "bg-emerald-500" : status() === "connecting" ? "bg-amber-400 animate-pulse" : "bg-[var(--color-text-muted)]"}`} />
          </div>
        ) : (
          <div class="flex items-center gap-2.5">
            <div class={`relative flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${status() === "ready" ? "bg-emerald-500/10 text-emerald-600" : status() === "connecting" ? "bg-amber-400/10 text-amber-500" : "bg-[var(--color-muted)] text-[var(--color-text-muted)]"}`}>
              {status() === "ready" ? (
                <Wifi size={16} />
              ) : status() === "connecting" ? (
                <Loader size={16} class="animate-spin" />
              ) : (
                <WifiOff size={16} />
              )}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">
                {status() === "ready" ? "已就绪" : status() === "connecting" ? "连接中..." : "离线"}
              </p>
              <p class="text-xs text-[var(--color-text-muted)] truncate">
                {user()?.name ?? "Worker"}
              </p>
              {(() => {
                const r = primary(user()?.roles ?? [])
                if (!r) return null
                return (
                  <span class={`inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border ${roleBadge(r)}`}>
                    {ROLES[r].label}
                  </span>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
