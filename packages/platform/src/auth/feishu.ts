import { env } from "@/env"

const BASE = "https://open.feishu.cn/open-apis"

type TokenResponse = { tenant_access_token: string; expire: number }
type UserInfo = {
  user_id: string
  union_id: string
  name: string
  email: string
  avatar_url: string
  department_ids: string[]
  job_level_id: string
}

let token: { value: string; expires: number } | undefined

async function tenantToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value
  const cfg = env()
  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: cfg.FEISHU_APP_ID,
      app_secret: cfg.FEISHU_APP_SECRET,
    }),
  })
  const data = (await res.json()) as TokenResponse
  token = { value: data.tenant_access_token, expires: Date.now() + (data.expire - 60) * 1000 }
  return token.value
}

export async function exchangeCode(code: string, redirect: string): Promise<{ access_token: string }> {
  const cfg = env()
  const body = {
    grant_type: "authorization_code",
    client_id: cfg.FEISHU_APP_ID,
    client_secret: cfg.FEISHU_APP_SECRET,
    code,
    redirect_uri: redirect,
  }
  console.log("[feishu] POST authen/v2/oauth/token client_id:", cfg.FEISHU_APP_ID, "redirect_uri:", redirect)
  const res = await fetch(`${BASE}/authen/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as any
  console.log("[feishu] token response code:", data.code, "error:", data.error, "desc:", data.error_description)
  if (data.code !== 0) throw new Error(data.error_description ?? data.error ?? `feishu token error code: ${data.code}`)
  if (!data.access_token) throw new Error("feishu returned empty access_token")
  return { access_token: data.access_token }
}

export async function userInfo(tk: string): Promise<UserInfo> {
  const res = await fetch(`${BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const raw = (await res.json()) as any
  console.log("[feishu] user_info response code:", raw.code, "msg:", raw.msg)
  if (raw.code !== 0) throw new Error(raw.msg ?? `feishu user_info error: ${raw.code}`)
  const d = raw.data
  if (!d) throw new Error("feishu user_info returned no data")
  return {
    user_id: d.user_id ?? d.open_id ?? "",
    union_id: d.union_id ?? "",
    name: d.name ?? "",
    email: d.email ?? d.enterprise_email ?? "",
    avatar_url: d.avatar_url ?? "",
    department_ids: d.department_ids ?? [],
    job_level_id: d.job_level_id ?? "",
  }
}

export async function departments(id: string): Promise<{ name: string; id: string }[]> {
  const tk = await tenantToken()
  const res = await fetch(
    `${BASE}/contact/v3/users/${id}?department_id_type=department_id&user_id_type=user_id`,
    { headers: { Authorization: `Bearer ${tk}` } },
  )
  const data = (await res.json()) as any
  return (data.data?.user?.department_ids ?? []).map((did: string) => ({ id: did, name: "" }))
}

export function verifyCallback(body: any, tk?: string): boolean {
  if (!tk) return true
  return body?.token === tk
}
