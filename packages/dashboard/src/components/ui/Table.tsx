import type { JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

type Props = {
  class?: string
  children?: JSX.Element
}

export function Table(props: Props) {
  return (
    <div class="overflow-x-auto">
      <table class={`w-full text-sm ${props.class ?? ""}`}>{props.children}</table>
    </div>
  )
}

export function TableHead(props: Props) {
  return <thead>{props.children}</thead>
}

export function TableBody(props: Props) {
  return <tbody>{props.children}</tbody>
}

export function TableRow(props: Props & { head?: boolean }) {
  return (
    <tr
      class={`border-b border-[var(--color-border)] ${props.head ? "bg-[var(--color-muted)]" : "hover:bg-[var(--color-muted)]"}`}
    >
      {props.children}
    </tr>
  )
}

export function TableCell(props: Props & { head?: boolean; align?: "left" | "right" }) {
  const cls = () => `py-3 px-4 ${props.head ? "font-medium" : ""} ${(props.align ?? "left") === "right" ? "text-right" : "text-left"}`
  return (
    <Dynamic component={props.head ? "th" : "td"} class={cls()}>
      {props.children}
    </Dynamic>
  )
}
