import { createSignal } from "solid-js"
import { api } from "../../lib/api"
import { Button } from "../ui/Button"
import { Badge } from "../ui/Badge"
import { notify } from "../../stores/notification"

type Auth = {
  id: string
  grantee_type: string
  grantee_id: string
  permission: string
}

type Props = {
  mcpId: string
  authorizations: Auth[]
  onRefresh: () => void
  canEdit?: boolean
}

export function AuthorizationPanel(props: Props) {
  const [revoking, setRevoking] = createSignal<string | null>(null)

  const handleRevoke = async (granteeType: string, granteeId: string) => {
    if (!props.canEdit) return
    setRevoking(`${granteeType}:${granteeId}`)
    try {
      await api.del(`/mcp/${props.mcpId}/authorize`, { grantee_type: granteeType, grantee_id: granteeId })
      notify("success", "已撤销授权")
      props.onRefresh()
    } catch (e) {
      notify("error", String(e))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div>
      <h3 class="font-semibold text-[var(--color-text-primary)] mb-2">授权列表</h3>
      {props.authorizations?.length ? (
        <div class="space-y-2">
          {props.authorizations.map((a) => (
            <div class="flex items-center justify-between py-2 px-3 rounded-[var(--radius-md)] bg-[var(--color-muted)]">
              <div class="flex gap-2">
                <Badge variant="default">{a.grantee_type}</Badge>
                <span class="text-sm font-mono">{a.grantee_id}</span>
                <Badge variant="info">{a.permission}</Badge>
              </div>
              {props.canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={revoking() === `${a.grantee_type}:${a.grantee_id}`}
                  onClick={() => handleRevoke(a.grantee_type, a.grantee_id)}
                >
                  撤销
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p class="text-sm text-[var(--color-text-muted)]">暂无授权</p>
      )}
    </div>
  )
}
