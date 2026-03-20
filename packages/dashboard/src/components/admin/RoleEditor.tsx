import { createResource, Show, For } from "solid-js"
import { api } from "../../lib/api"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { notify } from "../../stores/notification"

type Role = { id: string; name: string; display_name: string }
type UserRole = { role_id: string; role_name: string }

const labels: Record<string, string> = {
  developer: "开发者",
  finance: "财务",
  manager: "管理者",
  admin: "管理员",
}

function label(name: string, display?: string) {
  return labels[name] ?? display ?? name
}

type Props = {
  userId: string
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export function RoleEditor(props: Props) {
  const [roles, { refetch: refetchRoles }] = createResource(
    () => (props.open ? props.userId : false),
    () => api.get<Role[]>("/admin/roles"),
  )
  const [userRoles, { refetch }] = createResource(
    () => (props.open && props.userId ? props.userId : false),
    (uid) => api.get<{ roles: UserRole[] }>(`/admin/users/${uid}/roles`),
  )

  const assign = async (roleId: string) => {
    try {
      await api.post("/admin/roles/assign", { user_id: props.userId, role_id: roleId })
      notify("success", "角色已分配")
      refetch()
      props.onSaved?.()
    } catch (e) {
      notify("error", String(e))
    }
  }

  const remove = async (roleId: string) => {
    try {
      await api.del(`/admin/users/${props.userId}/roles/${roleId}`)
      notify("success", "角色已移除")
      refetch()
      props.onSaved?.()
    } catch (e) {
      notify("error", String(e))
    }
  }

  const assigned = () => new Set((userRoles()?.roles ?? []).map((r) => r.role_id))
  const available = () => (roles() ?? []).filter((r) => !assigned().has(r.id))

  return (
    <Modal open={props.open} onClose={props.onClose} title="分配角色">
      <div class="space-y-5">
        {/* Already assigned */}
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">已分配角色</h3>
          <Show when={(userRoles()?.roles ?? []).length > 0} fallback={
            <p class="text-sm text-[var(--color-text-muted)] py-2">暂无角色</p>
          }>
            <div class="space-y-1.5">
              <For each={userRoles()?.roles ?? []}>
                {(r) => (
                  <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border)]">
                    <div>
                      <span class="text-sm font-medium text-[var(--color-text-primary)]">{label(r.role_name)}</span>
                      <span class="text-xs text-[var(--color-text-muted)] ml-2 font-mono">{r.role_name}</span>
                    </div>
                    <button
                      class="text-xs text-[var(--color-error)] hover:underline"
                      onClick={() => remove(r.role_id)}
                    >
                      移除
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Available to assign */}
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">可分配角色</h3>
          <Show when={roles.loading}>
            <p class="text-sm text-[var(--color-text-muted)] py-2">加载中...</p>
          </Show>
          <Show when={!roles.loading && available().length === 0 && (roles() ?? []).length > 0}>
            <p class="text-sm text-[var(--color-text-muted)] py-2">所有角色已分配</p>
          </Show>
          <Show when={!roles.loading && (roles() ?? []).length === 0}>
            <p class="text-sm text-[var(--color-text-muted)] py-2">系统中暂无角色，请先执行角色初始化</p>
          </Show>
          <div class="space-y-1.5">
            <For each={available()}>
              {(r) => (
                <div class="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
                  <div>
                    <span class="text-sm font-medium text-[var(--color-text-primary)]">{label(r.name, r.display_name)}</span>
                    <span class="text-xs text-[var(--color-text-muted)] ml-2 font-mono">{r.name}</span>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => assign(r.id)}>分配</Button>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Modal>
  )
}
