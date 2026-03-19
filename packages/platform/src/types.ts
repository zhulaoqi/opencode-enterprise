/** Shared types for platform API */

export type UserContext = {
  sub: string
  roles: string[]
  depts: string[]
}

export type SessionInfo = {
  id: string
  user_id: string
  title: string | null
  status: string
}

export type TokenUsage = {
  input: number
  output: number
  cached?: number
}
