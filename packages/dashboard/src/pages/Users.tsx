import { createResource, createSignal } from "solid-js"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Skeleton } from "../components/ui/Skeleton"
import { Table, TableHead, TableBody, TableRow, TableCell } from "../components/ui/Table"
import { Dropdown } from "../components/ui/Dropdown"
import { Button } from "../components/ui/Button"
import { notify } from "../stores/notification"

type User = {
  internal_id: string
  name: string
  email?: string
  employee_id?: string
}

const PAGE_SIZE = 20

export default function Users() {
  const [search, setSearch] = createSignal("")
  const [filter, setFilter] = createSignal({ q: "", page: 0 })
  const [data] = createResource(
    () => filter(),
    (f) =>
      api.get<User[]>(
        `/admin/users?limit=${PAGE_SIZE}&offset=${f.page * PAGE_SIZE}${f.q ? `&search=${encodeURIComponent(f.q)}` : ""}`
      )
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
        <Button variant="secondary" size="sm" onClick={applySearch}>
          搜索
        </Button>
      </div>
      {data.loading && <Skeleton height={200} />}
      {data.error && <p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p>}
      {data() && (
        <Card>
          <Table>
            <TableHead>
              <TableRow head>
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
                        onClick={() => notify("info", "角色管理功能开发中")}
                      >
                        分配角色
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
    </div>
  )
}
