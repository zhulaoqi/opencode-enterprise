import type { ParentProps } from "solid-js"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { MobileNav } from "./MobileNav"
import { Toast } from "../ui/Toast"
import { connected } from "../../lib/ws"

export function Layout(props: ParentProps) {
  return (
    <div class="flex h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <div class="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main class="flex-1 overflow-auto pb-14 md:pb-0">
          {props.children}
        </main>
        <footer class="h-6 flex items-center justify-between px-4 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
          <span>{connected() ? "已连接" : "离线"}</span>
          <span>OpenCode Enterprise v0.0.1</span>
        </footer>
      </div>
      <MobileNav />
      <Toast />
    </div>
  )
}
