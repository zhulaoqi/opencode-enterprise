export const ROLES = {
  admin: { label: "管理员", color: "red", desc: "全部权限，包括用户管理、模型配置、节点操控，适合系统运维人员" },
  manager: { label: "管理者", color: "blue", desc: "可查看仪表盘、管理配额、查看节点状态（只读），适合团队负责人" },
  finance: { label: "财务", color: "purple", desc: "在开发者基础上可审批资源申请，适合财务/审批人员" },
  developer: { label: "开发者", color: "green", desc: "使用 AI 对话、执行代码任务，适合所有研发人员" },
} as const

export type RoleName = keyof typeof ROLES

const PRIORITY: RoleName[] = ["admin", "manager", "finance", "developer"]

export function primary(roles: string[]): RoleName | null {
  for (const r of PRIORITY) {
    if (roles.includes(r)) return r
  }
  return null
}

const COLORS: Record<string, string> = {
  red: "bg-red-500/10 text-red-600 border-red-200",
  blue: "bg-blue-500/10 text-blue-600 border-blue-200",
  purple: "bg-purple-500/10 text-purple-600 border-purple-200",
  green: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
}

export function badge(name: RoleName): string {
  return COLORS[ROLES[name].color] ?? COLORS.green!
}
