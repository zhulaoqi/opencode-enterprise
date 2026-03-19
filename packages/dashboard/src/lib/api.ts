import { token, logout } from "../stores/auth"

const BASE = "/api"

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const tk = token()
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
      ...opts?.headers,
    },
  })
  if (res.status === 401) {
    logout()
    throw new Error("Unauthorized")
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", ...(body != null && { body: JSON.stringify(body) }) }),
}
