type CostInput = {
  input: number
  output: number
  cached: number
  model: { input_cost: number; output_cost: number; cache_cost: number }
}

export function calculate(input: CostInput): number {
  return (
    (input.input * input.model.input_cost +
      input.output * input.model.output_cost +
      input.cached * input.model.cache_cost) /
    1_000_000
  )
}

const models: Record<string, { input_cost: number; output_cost: number; cache_cost: number }> = {
  "claude-sonnet-4-20250514": { input_cost: 3, output_cost: 15, cache_cost: 0.3 },
  "claude-3-5-haiku-20241022": { input_cost: 0.8, output_cost: 4, cache_cost: 0.08 },
  "gpt-4o": { input_cost: 2.5, output_cost: 10, cache_cost: 1.25 },
  "gpt-4o-mini": { input_cost: 0.15, output_cost: 0.6, cache_cost: 0.075 },
  "gemini-2.0-flash": { input_cost: 0.1, output_cost: 0.4, cache_cost: 0.025 },
}

export function modelCost(id: string) {
  return models[id] ?? { input_cost: 1, output_cost: 3, cache_cost: 0.1 }
}
