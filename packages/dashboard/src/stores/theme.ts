import { createSignal, createEffect, type ParentComponent } from "solid-js"

export type Theme = "light" | "dark" | "system"

const [theme, setTheme] = createSignal<Theme>(
  (typeof localStorage !== "undefined"
    ? (localStorage.getItem("theme") as Theme)
    : null) ?? "system"
)

function resolved(): "light" | "dark" {
  if (theme() === "system")
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  return theme() as "light" | "dark"
}

export const ThemeProvider: ParentComponent = (props) => {
  createEffect(() => {
    const t = resolved()
    document.documentElement.setAttribute("data-theme", t)
    localStorage.setItem("theme", theme())
  })
  return props.children
}

export { theme, setTheme, resolved }
