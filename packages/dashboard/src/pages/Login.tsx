import { createSignal, onMount, Show } from "solid-js"
import { login } from "../stores/auth"
import { Shield, Zap, Bot, AlertCircle, Loader2 } from "lucide-solid"

function Logo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="14" fill="url(#g)" />
      <path d="M18 16l-6 8 6 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M30 16l6 8-6 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M27 14l-6 20" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="48" y2="48">
          <stop stop-color="#3b82f6" />
          <stop offset="1" stop-color="#1d4ed8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function FeishuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.947 3.222c-.092-.105-.262-.02-.23.116C4.86 9.273 7.778 13.998 12.04 17.12l1.04.76c.123.09.082.286-.066.315l-6.545 1.283c-.152.03-.273-.13-.196-.263C8.42 15.164 8.02 10.427 5.252 5.052a4.163 4.163 0 00-1.305-1.53v-.3z" />
      <path d="M20.156 8.91c.077-.14-.065-.301-.206-.234-2.296 1.09-4.078 2.744-5.404 4.74a.177.177 0 00.046.243l3.64 2.665c.099.073.24.01.245-.113.083-2.535.675-5.041 1.68-7.301z" opacity="0.6" />
    </svg>
  )
}

const features = [
  { icon: Bot, text: "AI 智能对话" },
  { icon: Zap, text: "MCP 工具编排" },
  { icon: Shield, text: "企业级安全" },
]

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
    <div class="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 25%, #f0f4ff 50%, #dbeafe 75%, #eff6ff 100%)",
      }}
    >
      {/* Decorative background elements */}
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)" }} />
        <div class="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }} />
        <div class="absolute top-1/3 left-1/4 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
      </div>

      <div class="relative z-10 w-full max-w-[420px] mx-4">
        {/* Logo + Title */}
        <div class="flex flex-col items-center mb-8">
          <div class="mb-4 drop-shadow-lg">
            <Logo />
          </div>
          <h1 class="text-[26px] font-bold tracking-tight" style={{ color: "#0f172a" }}>
            OpenCode
          </h1>
          <p class="text-sm mt-1" style={{ color: "#64748b" }}>
            Enterprise AI Platform
          </p>
        </div>

        {/* Login Card */}
        <div class="rounded-2xl p-8 shadow-xl border"
          style={{
            background: "rgba(255,255,255,0.85)",
            "backdrop-filter": "blur(20px)",
            "-webkit-backdrop-filter": "blur(20px)",
            "border-color": "rgba(255,255,255,0.6)",
            "box-shadow": "0 20px 60px -12px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.5)",
          }}
        >
          <Show when={error()}>
            <div class="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl text-sm"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
                color: "#dc2626",
              }}
            >
              <AlertCircle size={16} class="shrink-0 mt-0.5" />
              <span class="break-words">{error()}</span>
            </div>
          </Show>

          <button
            class="w-full h-[52px] rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-200 disabled:opacity-50 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#fff",
              "box-shadow": "0 4px 14px -3px rgba(37,99,235,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
            onMouseEnter={(e) => { if (!loading()) e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px -3px rgba(37,99,235,0.6), inset 0 1px 0 rgba(255,255,255,0.15)" }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 14px -3px rgba(37,99,235,0.5), inset 0 1px 0 rgba(255,255,255,0.15)" }}
            onClick={handleFeishuLogin}
            disabled={loading()}
          >
            <Show when={loading()} fallback={
              <>
                <FeishuIcon />
                <span>使用飞书登录</span>
              </>
            }>
              <Loader2 size={18} class="animate-spin" />
              <span>正在跳转...</span>
            </Show>
          </button>

          <div class="flex items-center gap-3 mt-6 mb-5">
            <div class="flex-1 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
            <span class="text-xs" style={{ color: "#94a3b8" }}>安全企业认证</span>
            <div class="flex-1 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
          </div>

          {/* Feature tags */}
          <div class="flex justify-center gap-2 flex-wrap">
            {features.map((f) => (
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(37,99,235,0.06)",
                  color: "#3b82f6",
                  border: "1px solid rgba(37,99,235,0.1)",
                }}
              >
                <f.icon size={12} />
                {f.text}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p class="text-center text-xs mt-6" style={{ color: "#94a3b8" }}>
          Powered by OpenCode &middot; 数据安全由飞书企业认证保障
        </p>
      </div>
    </div>
  )
}
