import { createSignal } from "solid-js"

export type Toast = {
  id: string
  type: "success" | "error" | "warning" | "info"
  message: string
  duration?: number
}

const [toasts, setToasts] = createSignal<Toast[]>([])

export { toasts }

export function notify(type: Toast["type"], message: string, duration = 4000) {
  const id = Math.random().toString(36).slice(2)
  setToasts((prev) => [...prev.slice(-2), { id, type, message, duration }])
  if (duration > 0) setTimeout(() => dismiss(id), duration)
}

export function dismiss(id: string) {
  setToasts((prev) => prev.filter((t) => t.id !== id))
}
