import { describe, test, expect } from "bun:test"
import { calculate } from "@/billing/cost"

describe("cost", () => {
  test("calculates token cost correctly", () => {
    const cost = calculate({
      input: 1000,
      output: 500,
      cached: 200,
      model: { input_cost: 3, output_cost: 15, cache_cost: 0.3 },
    })
    expect(cost).toBeCloseTo(0.01056, 5)
  })
})
