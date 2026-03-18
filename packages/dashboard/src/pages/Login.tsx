import { onMount } from "solid-js"
import { login } from "../stores/auth"
import { api } from "../lib/api"

export default function Login() {
  onMount(async () => {
    const code = new URLSearchParams(window.location.search).get("code")
    if (code) {
      try {
        const res = await fetch("/api/auth/feishu/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        })
        if (!res.ok) throw new Error(await res.text())
        const { token: tk, user: u } = await res.json()
        login(tk, { id: u.id, name: u.name, email: u.email, avatar: u.avatar })
        window.location.href = "/"
      } catch (e) {
        console.error("Login failed:", e)
      }
    }
  })

  const handleFeishuLogin = async () => {
    const res = await fetch("/api/auth/feishu/url")
    const { url } = await res.json()
    window.location.href = url
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
        <button
          class="w-full h-12 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-on-primary)] font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          onClick={handleFeishuLogin}
        >
          飞书登录
        </button>
      </div>
    </div>
  )
}
