import { A } from "@solidjs/router"

export default function NotFound() {
  return (
    <div class="min-h-[50vh] flex flex-col items-center justify-center p-4">
      <h1 class="text-4xl font-bold text-[var(--color-text-muted)]">404</h1>
      <p class="text-[var(--color-text-secondary)] mt-2">页面不存在</p>
      <A href="/" class="mt-4 text-[var(--color-primary)] hover:underline">返回首页</A>
    </div>
  )
}
