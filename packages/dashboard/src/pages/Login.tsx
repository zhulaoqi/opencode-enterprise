import { createSignal, onMount, Show } from "solid-js"
import { login } from "../stores/auth"

export default function Login() {
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")

  onMount(async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    if (!code) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/feishu/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? body.message ?? `服务端错误 ${res.status}`)
      login(body.token, { id: body.user.id, name: body.user.name, email: body.user.email, avatar: body.user.avatar })
      window.location.href = "/"
    } catch (e: any) {
      console.error("Login failed:", e)
      setError(e?.message ?? "登录失败，请重试")
      setLoading(false)
      window.history.replaceState({}, "", "/login")
    }
  })

  const handleFeishuLogin = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/feishu/url")
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setError("无法获取飞书登录地址")
      setLoading(false)
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div class="w-full max-w-sm p-8 rounded-[var(--radius-xl)] bg-[var(--color-card)] border border-[var(--color-border)] shadow-[var(--shadow-lg)]">
        <h1 class="text-2xl font-bold text-center text-[var(--color-text-primary)] mb-2">
          OpenCode Enterprise
        </h1>
        <p class="text-sm text-center text-[var(--color-text-muted)] mb-6">
          使用飞书账号登录
        </p>
        <Show when={error()}>
          <div class="mb-4 p-3 rounded-[var(--radius-md)] bg-red-50 border border-red-200 text-red-700 text-sm break-words">
            {error()}
          </div>
        </Show>
        <button
          class="w-full h-12 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-on-primary)] font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
          onClick={handleFeishuLogin}
          disabled={loading()}
        >
          {loading() ? "登录中..." : "飞书登录"}
        </button>
      </div>
    </div>
  )
}
