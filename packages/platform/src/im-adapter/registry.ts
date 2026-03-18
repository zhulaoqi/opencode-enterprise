import type { ImAdapter } from "./adapter"

const adapters = new Map<string, ImAdapter>()

export function register(adapter: ImAdapter) {
  adapters.set(adapter.source, adapter)
}

export function get(source: string): ImAdapter | undefined {
  return adapters.get(source)
}

export function all() {
  return [...adapters.values()]
}
