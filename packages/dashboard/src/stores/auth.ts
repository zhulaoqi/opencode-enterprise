import { createSignal } from "solid-js"

export type User = {
  id: string
  name: string
  email?: string
  avatar?: string
  roles?: string[]
}

const [_token, setToken] = createSignal(
  typeof localStorage !== "undefined" ? localStorage.getItem("token") ?? "" : ""
)
const [user, setUser] = createSignal<User | null>(null)

export function token() {
  return _token()
}

export function login(tk: string, u: User) {
  localStorage.setItem("token", tk)
  setToken(tk)
  setUser(u)
}

export function logout() {
  localStorage.removeItem("token")
  setToken("")
  setUser(null)
}

export function isLoggedIn() {
  return !!_token()
}

export { user, setUser }
