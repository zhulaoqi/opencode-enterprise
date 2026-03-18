import { A } from "@solidjs/router"
import { MessageSquare, Package, BarChart3, Users, Settings } from "lucide-solid"

const nav = [
  { href: "/", label: "对话", icon: MessageSquare },
  { href: "/mcp", label: "MCP", icon: Package },
  { href: "/dashboard", label: "仪表盘", icon: BarChart3 },
  { href: "/admin/users", label: "用户", icon: Users },
  { href: "/settings", label: "设置", icon: Settings },
]

export function MobileNav() {
  return (
    <nav class="fixed bottom-0 left-0 right-0 h-14 flex items-center justify-around bg-[var(--color-bg-elevated)] border-t border-[var(--color-border)] z-[var(--z-sticky)] md:hidden">
      {nav.map((item) => (
        <A
          href={item.href}
          class="flex flex-col items-center justify-center flex-1 py-2 text-[var(--color-text-muted)] data-[active]:text-[var(--color-primary)]"
          activeClass="!text-[var(--color-primary)]"
          end={item.href === "/"}
        >
          <item.icon size={22} />
          <span class="text-[10px] mt-0.5">{item.label}</span>
        </A>
      ))}
    </nav>
  )
}
