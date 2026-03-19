import { createResource, createSignal } from "solid-js"
import { api } from "../../lib/api"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Badge } from "../ui/Badge"
import { notify } from "../../stores/notification"

type Role = { id: string; name: string; display_name: string }
type UserRole = { role_id: string; role_name: string }

type Props = {
  userId: string
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export function RoleEditor(props: Props) {
  const [roles] = createResource(() => (props.open ? api.get<Role[]>("/admin/roles") : null))
  const [userRoles, { refetch }] = createResource(
    () => (props.open && props.userId ? api.get<{ roles: UserRole[] }>(`/admin/users/${props.userId}/roles`) : null)
  )

  const assign = async (roleId: string) => {
    try {
      await api.post("/admin/roles/assign", { user_id: props.userId, role_id: roleId })
      notify("success", "已分配角色")
      refetch()
      props.onSaved?.()
    } catch (e) {
      notify("error", String(e))
    }
  }

  const remove = async (roleId: string) => {
    try {
      await api.del(`/admin/users/${props.userId}/roles/${roleId}`)
      notify("success", "已移除角色")
      refetch()
      props.onSaved?.()
    } catch (e) {
      notify("error", String(e))
    }
  }

  const assigned = () => new Set((userRoles()?.roles ?? []).map((r) => r.role_id))

  return (
    <Modal open={props.open} onClose={props.onClose} title="分配角色">
      <div class="space-y-4">
        <div>
          <h3 class="text-sm font-medium text-[var(--color-text-muted)] mb-2">已分配</h3>
          <div class="flex flex-wrap gap-2">
            {(userRoles()?.roles ?? []).map((r) => (
              <Badge variant="default" class="flex items-center gap-1">
                {r.role_name}
                <button class="ml-1 hover:text-[var(--color-error)]" onClick={() => remove(r.role_id)}>
                  ×
                </button>
              </Badge>
            ))}
            {!(userRoles()?.roles?.length) && <span class="text-sm text-[var(--color-text-muted)]">暂无</span>}
          </div>
        </div>
        <div>
          <h3 class="text-sm font-medium text-[var(--color-text-muted)] mb-2">可分配</h3>
          <div class="flex flex-wrap gap-2">
            {(roles() ?? [])
              .filter((r) => !assigned().has(r.id))
              .map((r) => (
                <Button variant="secondary" size="sm" onClick={() => assign(r.id)}>
                  + {r.display_name}
                </Button>
              ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
