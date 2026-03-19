import type { JSX } from "solid-js"
import { createSignal, Show } from "solid-js"

type Props = {
  trigger: (opts: { onClick: () => void }) => JSX.Element
  children: JSX.Element
  class?: string
}

export function Dropdown(props: Props) {
  const [open, setOpen] = createSignal(false)
  const toggle = () => setOpen((o) => !o)

  return (
    <div class={`relative inline-block ${props.class ?? ""}`}>
      <div>{typeof props.trigger === "function" ? props.trigger({ onClick: toggle }) : props.trigger}</div>
      <Show when={open()}>
        <div
          class="fixed inset-0 z-[9]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div
          class="absolute right-0 top-full mt-1 z-10 min-w-[120px] py-1 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-lg"
          onClick={() => setOpen(false)}
        >
          {props.children}
        </div>
      </Show>
    </div>
  )
}
