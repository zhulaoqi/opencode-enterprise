import { createResource, createSignal } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Table, TableHead, TableBody, TableRow, TableCell } from "../components/ui/Table"
import { Avatar } from "../components/ui/Avatar"
import { Dropdown } from "../components/ui/Dropdown"
import { Button } from "../components/ui/Button"
import { RoleEditor } from "../components/admin/RoleEditor"
import { notify } from "../stores/notification"

type User = {
  internal_id: string
  name: string
  email?: string
  employee_id?: string
  avatar_url?: string
}

const PAGE_SIZE = 20
const ROLES = ["全部", "developer", "finance", "manager", "admin"] as const
const STATUSES = ["全部", "active", "disabled"] as const

const sel = "h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"

function csv(rows: User[]) {
  const header = "ID,姓名,工号,邮箱"
  const lines = rows.map((u) =>
    [u.internal_id, u.name, u.employee_id ?? "", u.email ?? ""].join(",")
  )
  const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "users.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function Users() {
  const [search, setSearch] = createSignal("")
  const [role, setRole] = createSignal("全部")
  const [status, setStatus] = createSignal("全部")
  const [filter, setFilter] = createSignal({ q: "", page: 0 })
  const [roleUserId, setRoleUserId] = createSignal<string | null>(null)
  const [data] = createResource(
    () => ({ f: filter(), r: role(), s: status() }),
    (p) => {
      let url = `/admin/users?limit=${PAGE_SIZE}&offset=${p.f.page * PAGE_SIZE}`
      if (p.f.q) url += `&search=${encodeURIComponent(p.f.q)}`
      if (p.r !== "全部") url += `&role=${encodeURIComponent(p.r)}`
      if (p.s !== "全部") url += `&status=${encodeURIComponent(p.s)}`
      return api.get<User[]>(url)
    }
  )

  const applySearch = () => setFilter({ q: search(), page: 0 })
  const nextPage = () => setFilter((f) => ({ ...f, page: f.page + 1 }))
  const prevPage = () => setFilter((f) => ({ ...f, page: Math.max(0, f.page - 1) }))

  const users = () => (Array.isArray(data()) ? data()! : [])
  const hasMore = () => users().length === PAGE_SIZE

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-4">用户管理</h1>
      <div class="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="搜索姓名、邮箱、工号"
          class="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm w-48"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
        />
        <select class={sel} value={role()} onChange={(e) => setRole(e.currentTarget.value)}>
          {ROLES.map((r) => <option value={r}>{r === "全部" ? "角色: 全部" : r}</option>)}
        </select>
        <select class={sel} value={status()} onChange={(e) => setStatus(e.currentTarget.value)}>
          {STATUSES.map((s) => <option value={s}>{s === "全部" ? "状态: 全部" : s}</option>)}
        </select>
        <Button variant="secondary" size="sm" onClick={applySearch}>
          搜索
        </Button>
        <Button variant="secondary" size="sm" onClick={() => csv(users())}>
          导出
        </Button>
      </div>
      {data.loading && <Skeleton height={200} />}
      {data.error && <p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p>}
      {data() && (
        <Card>
          <Table>
            <TableHead>
              <TableRow head>
                <TableCell head></TableCell>
                <TableCell head>ID</TableCell>
                <TableCell head>姓名</TableCell>
                <TableCell head>工号</TableCell>
                <TableCell head>邮箱</TableCell>
                <TableCell head align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users().map((u) => (
                <TableRow>
                  <TableCell>
                    <Avatar name={u.name} src={u.avatar_url} size="sm" />
                  </TableCell>
                  <TableCell>
                    <span class="font-mono text-xs">{u.internal_id?.slice(0, 8)}...</span>
                  </TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.employee_id ?? "-"}</TableCell>
                  <TableCell>{u.email ?? "-"}</TableCell>
                  <TableCell align="right">
                    <Dropdown
                      trigger={({ onClick }) => (
                        <button
                          class="px-2 py-1 rounded text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"
                          onClick={onClick}
                        >
                          ⋮
                        </button>
                      )}
                    >
                      <button
                        class="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-muted)]"
                        onClick={() => setRoleUserId(u.internal_id)}
                      >
                        分配角色
                      </button>
                      <button
                        class="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-muted)]"
                        onClick={() => notify("info", "功能开发中")}
                      >
                        调整配额
                      </button>
                      <button
                        class="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-muted)]"
                        onClick={() => notify("info", "功能开发中")}
                      >
                        查看记录
                      </button>
                    </Dropdown>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div class="flex justify-between items-center mt-4 px-4 py-2 border-t border-[var(--color-border)]">
            <span class="text-sm text-[var(--color-text-muted)]">
              第 {filter().page + 1} 页
            </span>
            <div class="flex gap-2">
              <Button variant="ghost" size="sm" disabled={filter().page === 0} onClick={prevPage}>
                上一页
              </Button>
              <Button variant="ghost" size="sm" disabled={!hasMore()} onClick={nextPage}>
                下一页
              </Button>
            </div>
          </div>
        </Card>
      )}
      <RoleEditor
        userId={roleUserId() ?? ""}
        open={!!roleUserId()}
        onClose={() => setRoleUserId(null)}
      />
    </div>
  )
}
