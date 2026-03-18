import { render } from "solid-js/web"
import { App } from "./app"
import { token, setUser } from "./stores/auth"
import { api } from "./lib/api"
import "./styles/global.css"

if (token()) {
  api.get<{ id: string; name: string; email?: string; avatar?: string }>("/auth/me").then((u) => setUser(u)).catch(() => {})
}

render(() => <App />, document.getElementById("root")!)
