import z from "zod"

const schema = z.object({
  ENTERPRISE_MODE: z.string().default("false"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default("2h"),
  FEISHU_APP_ID: z.string(),
  FEISHU_APP_SECRET: z.string(),
  FEISHU_ENCRYPT_KEY: z.string().optional(),
  FEISHU_VERIFICATION_TOKEN: z.string().optional(),
  DASHBOARD_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function env(): Env {
  if (cached) return cached
  cached = schema.parse(process.env)
  return cached
}

export function isEnterprise(): boolean {
  return process.env.ENTERPRISE_MODE === "true"
}
