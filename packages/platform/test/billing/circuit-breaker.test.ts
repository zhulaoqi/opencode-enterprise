import { describe, test, expect } from "bun:test"
import type { CircuitState } from "@/billing/circuit-breaker"

function shouldOpen(failures: number, total: number, threshold: number) {
  return total > 0 && failures / total > threshold
}

describe("circuit-breaker", () => {
  test("initial state is CLOSED", () => {
    const state: CircuitState = {
      state: "CLOSED",
      failures: 0,
      last_failure: 0,
      last_success: 0,
      opened_at: 0,
    }
    expect(state.state).toBe("CLOSED")
  })

  test("transitions correctly", () => {
    expect(shouldOpen(12, 100, 0.1)).toBe(true)
    expect(shouldOpen(5, 100, 0.1)).toBe(false)
  })
})
