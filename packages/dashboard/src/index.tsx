import { render } from "solid-js/web"
import { App } from "./app"
import { token, setUser, logout } from "./stores/auth"
import * as worker from "./lib/worker"
import * as stream from "./lib/stream"
import "./styles/global.css"

async function boot() {
  if (token()) {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.ok) {
        setUser(await res.json())
        await worker.connect()
        stream.connect()
      } else {
        logout()
      }
    } catch {
      /* network error — keep token, will retry on interaction */
    }
  }
  render(() => <App />, document.getElementById("root")!)
}

boot()
