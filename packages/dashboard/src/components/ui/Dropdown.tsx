import type { JSX } from "solid-js"
import { createSignal, Show, onCleanup } from "solid-js"
import { Portal } from "solid-js/web"

type Props = {
  trigger: (opts: { onClick: () => void }) => JSX.Element
  children: JSX.Element
  class?: string
}

export function Dropdown(props: Props) {
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ top: 0, left: 0 })
  let ref: HTMLDivElement | undefined

  const toggle = () => {
    if (!open() && ref) {
      const rect = ref.getBoundingClientRect()
      const menuW = 140
      const left = Math.min(rect.right, window.innerWidth - menuW)
      setPos({ top: rect.bottom + 4, left })
    }
    setOpen((o) => !o)
  }

  const close = () => setOpen(false)

  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }

  return (
    <div ref={ref} class={`relative inline-block ${props.class ?? ""}`}>
      <div>{typeof props.trigger === "function" ? props.trigger({ onClick: toggle }) : props.trigger}</div>
      <Show when={open()}>
        <Portal>
          <div class="fixed inset-0 z-[var(--z-dropdown)]" onClick={close} onKeyDown={onKey} aria-hidden="true" />
          <div
            class="fixed z-[var(--z-dropdown)] min-w-[140px] py-1 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-[var(--shadow-lg)]"
            style={{ top: `${pos().top}px`, left: `${pos().left}px`, transform: "translateX(-100%)" }}
            onClick={close}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </div>
  )
}
