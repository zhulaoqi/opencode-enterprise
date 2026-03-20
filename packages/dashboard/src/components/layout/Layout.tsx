import type { ParentProps } from "solid-js"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { MobileNav } from "./MobileNav"
import { Toast } from "../ui/Toast"
import { ready as connected } from "../../lib/worker"

export function Layout(props: ParentProps) {
  return (
    <div class="flex h-screen bg-[var(--color-bg)]">
      <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1000] focus:px-4 focus:py-2 focus:bg-[var(--color-primary)] focus:text-[var(--color-on-primary)] focus:rounded-[var(--radius-md)]">跳到主内容</a>
      <Sidebar />
      <div class="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main id="main-content" class="flex-1 overflow-auto pb-14 md:pb-0">
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
