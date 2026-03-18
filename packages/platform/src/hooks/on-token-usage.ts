import { database } from "@/db"
import * as identity from "@/auth/identity"
import * as quota from "@/billing/quota"
import * as cost from "@/billing/cost"
import * as audit from "@/billing/audit"

export async function onTokenUsage(input: {
  sessionID: string
  userId?: string
  model: string
  provider: string
  input: number
  output: number
  cached: number
  cost: number
}) {
  const c = input.cost > 0 ? input.cost : cost.calculate({
    input: input.input,
    output: input.output,
    cached: input.cached,
    model: cost.modelCost(input.model),
  })
  const tokens = input.input + input.output + input.cached

  if (input.userId) {
    await quota.increment("user", input.userId, "daily", tokens, c)
    await quota.increment("user", input.userId, "monthly", tokens, c)

    const db = database()
    const user = await identity.byInternalId(db, input.userId)
    if (user) {
      const deptIds = (user.department_ids ?? []) as string[]
      for (const deptId of deptIds) {
        await quota.increment("department", deptId, "daily", tokens, c)
        await quota.increment("department", deptId, "monthly", tokens, c)
      }
    }

    audit.log({
      user_id: input.userId,
      session_id: input.sessionID,
      action: "llm_step",
      model_id: input.model,
      provider_id: input.provider,
      tokens_input: input.input,
      tokens_output: input.output,
      tokens_cached: input.cached,
      cost_usd: String(c),
    })
  }
}
