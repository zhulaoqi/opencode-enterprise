import { A } from "@solidjs/router"
import { MessageSquare, Package, BarChart3, Users, Settings, ChevronLeft, ChevronRight, PieChart, FileText } from "lucide-solid"
import { Avatar } from "../ui/Avatar"
import { createSignal } from "solid-js"
import { user } from "../../stores/auth"

const nav = [
  { href: "/", label: "对话", icon: MessageSquare },
  { href: "/mcp", label: "MCP 市场", icon: Package },
  { href: "/dashboard", label: "仪表盘", icon: BarChart3 },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/quotas", label: "配额管理", icon: PieChart },
  { href: "/admin/audit", label: "审计日志", icon: FileText },
  { href: "/settings", label: "配置", icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = createSignal(false)
  const w = () => (collapsed() ? "w-16" : "w-60")

  return (
    <aside
      class={`${w()} flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] transition-all duration-200 shrink-0`}
    >
      <div class="h-12 flex items-center justify-between px-3 border-b border-[var(--color-border)]">
        {!collapsed() && <span class="font-semibold text-[var(--color-text-primary)]">OpenCode</span>}
        <button
          class="p-2 rounded hover:bg-[var(--color-muted)]"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed() ? "展开" : "折叠"}
        >
          {collapsed() ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav class="flex-1 py-2">
        {nav.map((item) => (
          <A
            href={item.href}
            class="flex items-center gap-3 px-3 py-2 mx-2 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)] data-[active]:bg-[var(--color-primary-light)] data-[active]:text-[var(--color-primary)] data-[active]:font-semibold data-[active]:border-l-[3px] data-[active]:border-l-[var(--color-primary)]"
            activeClass="!bg-[var(--color-primary-light)] !text-[var(--color-primary)] font-semibold border-l-[3px] border-l-[var(--color-primary)]"
            end={item.href === "/"}
          >
            <item.icon size={20} class="shrink-0" />
            {!collapsed() && <span>{item.label}</span>}
          </A>
        ))}
      </nav>
      {!collapsed() && user() && (
        <div class="p-3 border-t border-[var(--color-border)]">
          <div class="flex items-center gap-2">
            <Avatar name={user()?.name} src={user()?.avatar} size="sm" />
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">{user()?.name}</p>
              <p class="text-xs text-[var(--color-text-muted)] truncate">{user()?.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
