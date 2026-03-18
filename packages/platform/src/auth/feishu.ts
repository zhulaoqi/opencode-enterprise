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

export async function exchangeCode(code: string): Promise<{ access_token: string; user_id: string }> {
  const tk = await tenantToken()
  const res = await fetch(`${BASE}/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tk}`,
    },
    body: JSON.stringify({ grant_type: "authorization_code", code }),
  })
  const data = (await res.json()) as any
  return { access_token: data.data.access_token, user_id: data.data.user_id }
}

export async function userInfo(tk: string): Promise<UserInfo> {
  const res = await fetch(`${BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const data = (await res.json()) as any
  return {
    user_id: data.data.user_id,
    union_id: data.data.union_id,
    name: data.data.name,
    email: data.data.email ?? "",
    avatar_url: data.data.avatar_url ?? "",
    department_ids: data.data.department_ids ?? [],
    job_level_id: data.data.job_level_id ?? "",
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
