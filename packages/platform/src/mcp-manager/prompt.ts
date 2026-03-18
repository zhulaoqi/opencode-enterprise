export function toolChangePrompt(added: string[], removed: string[]): string {
  const parts: string[] = []
  if (added.length > 0) {
    parts.push(`New tools are now available: ${added.join(", ")}. You can use these tools in your responses.`)
  }
  if (removed.length > 0) {
    parts.push(`The following tools are no longer available: ${removed.join(", ")}. Do not attempt to use them.`)
  }
  return parts.length > 0 ? `[System Update] ${parts.join(" ")}` : ""
}
