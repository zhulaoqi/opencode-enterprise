export const ROLES = {
  admin: {
    label: "管理员",
    desc: "全部权限：用户管理、模型配置、节点操控",
    pill: "bg-indigo-500/10 text-indigo-700",
    dot: "bg-indigo-500",
  },
  manager: {
    label: "管理者",
    desc: "查看仪表盘、管理配额、只读查看节点",
    pill: "bg-sky-500/10 text-sky-700",
    dot: "bg-sky-500",
  },
  finance: {
    label: "财务",
    desc: "开发者权限 + 审批资源申请",
    pill: "bg-amber-500/10 text-amber-700",
    dot: "bg-amber-500",
  },
  developer: {
    label: "开发者",
    desc: "AI 对话、代码执行、MCP 工具调用",
    pill: "bg-teal-500/10 text-teal-700",
    dot: "bg-teal-500",
  },
} as const

export type RoleName = keyof typeof ROLES

const PRIORITY: RoleName[] = ["admin", "manager", "finance", "developer"]

export function primary(roles: string[]): RoleName | null {
  for (const r of PRIORITY) {
    if (roles.includes(r)) return r
  }
  return null
}

export function badge(name: RoleName): string {
  return ROLES[name].pill
}
