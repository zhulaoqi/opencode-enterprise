import type { ParentComponent } from "solid-js"
import { Show } from "solid-js"
import { Navigate } from "@solidjs/router"
import { isLoggedIn } from "../stores/auth"

export const AuthGuard: ParentComponent = (props) => {
  return (
    <Show when={isLoggedIn()} fallback={<Navigate href="/login" />}>
      {props.children}
    </Show>
  )
}
