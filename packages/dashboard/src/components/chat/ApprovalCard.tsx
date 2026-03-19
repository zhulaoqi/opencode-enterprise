import { Button } from "../ui/Button"
import { Badge } from "../ui/Badge"

type Props = {
  action: string
  initiator: string
  risk?: "low" | "medium" | "high"
  onApprove?: () => void
  onReject?: () => void
}

const riskLabel = (r?: string) => (r === "high" ? "高" : r === "medium" ? "中" : r === "low" ? "低" : "未知")
const riskVariant = (r?: string) => (r === "high" ? "error" : r === "medium" ? "warning" : "info")

export function ApprovalCard(props: Props) {
  return (
    <div class="flex justify-start mb-4">
      <div class="max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 bg-[var(--color-warning-light)] border border-[var(--color-warning)]">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm font-semibold text-[var(--color-warning)]">需要审批</span>
        </div>
        <p class="text-sm text-[var(--color-text-primary)] mb-1">
          <span class="text-[var(--color-text-muted)]">操作:</span> {props.action}
        </p>
        <p class="text-sm text-[var(--color-text-primary)] mb-1">
          <span class="text-[var(--color-text-muted)]">发起人:</span> {props.initiator}
        </p>
        {props.risk && (
          <p class="text-sm mb-3">
            <span class="text-[var(--color-text-muted)]">风险等级:</span>{" "}
            <Badge variant={riskVariant(props.risk)}>{riskLabel(props.risk)}</Badge>
          </p>
        )}
        <div class="flex gap-2">
          <Button variant="danger" size="sm" onClick={props.onReject}>
            拒绝
          </Button>
          <Button variant="primary" size="sm" onClick={props.onApprove}>
            批准
          </Button>
        </div>
      </div>
    </div>
  )
}
