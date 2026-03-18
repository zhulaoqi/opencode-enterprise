import { theme, setTheme, resolved } from "../stores/theme"

export default function Settings() {
  return (
    <div class="p-4 max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">设置</h1>
      <div class="space-y-6">
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
      </div>
    </div>
  )
}
