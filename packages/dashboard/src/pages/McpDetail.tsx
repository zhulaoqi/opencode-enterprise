import { createResource } from "solid-js"
import { useParams } from "@solidjs/router"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Badge } from "../components/ui/Badge"
import { Skeleton } from "../components/ui/Skeleton"
import { A } from "@solidjs/router"
import { AuthorizationPanel } from "../components/mcp/AuthorizationPanel"
import { TokenChart } from "../components/dashboard/TokenChart"
import { Button } from "../components/ui/Button"
import { user } from "../stores/auth"
import { notify } from "../stores/notification"

type McpDetail = {
  id: string
  name: string
  display_name: string
  description?: string
  visibility: string
  tags?: string[]
  owner_id?: string
  health_status?: string
  last_health_at?: string
}

type Auth = {
  id: string
  grantee_type: string
  grantee_id: string
  permission: string
}

export default function McpDetail() {
  const params = useParams()
  const id = () => params.id
  const [data, { refetch }] = createResource(id, (i) =>
    api.get<{ mcp: McpDetail; authorizations: Auth[] }>(`/mcp/${i}`)
  )
  const [health] = createResource(id, (i) =>
    api.get<{ status: string; checked_at?: string }>(`/mcp/${i}/health`).catch(() => ({ status: "unknown" } as { status: string; checked_at?: string }))
  )
  const [usage] = createResource(id, (i) =>
    api.get<{ trend: { day: string; tokens_in: number; tokens_out: number }[] }>(`/mcp/${i}/usage?days=7`)
  )
  const [tools] = createResource(id, (i) =>
    api.get<{ tools: { tool: string; calls: number }[] }>(`/mcp/${i}/tools`)
  )

  const usageData = () => {
    const t = usage()?.trend
    if (!t?.length) return []
    return t.map((p) => ({
      day: typeof p.day === "string" ? p.day : new Date(p.day).toISOString().slice(0, 10),
      tokens_in: Number(p.tokens_in ?? 0),
      tokens_out: Number(p.tokens_out ?? 0),
    }))
  }

  const canEdit = () => {
    const m = data()?.mcp
    const u = user()
    return Boolean(m && u && m.owner_id === u.id)
  }

  return (
    <div class="p-4 max-w-3xl mx-auto">
      <A href="/mcp" class="text-sm text-[var(--color-primary)] hover:underline mb-4 inline-block">
        ← 返回市场
      </A>
      {data.loading && (
        <>
          <Skeleton height={32} class="mb-4" />
          <Skeleton height={100} />
        </>
      )}
      {data.error && (
        <p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p>
      )}
      {data() && (
        <div class="space-y-4">
          <Card>
            <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              {data()!.mcp.display_name}
            </h1>
            <p class="text-[var(--color-text-muted)] mb-4">{data()!.mcp.description ?? data()!.mcp.name}</p>
            <div class="flex gap-2 flex-wrap mb-4">
              <Badge variant="default">{data()!.mcp.visibility}</Badge>
              <Badge variant={health()?.status === "healthy" ? "success" : health()?.status === "unhealthy" ? "error" : "warning"}>
                {health()?.status === "healthy" ? "健康" : health()?.status === "unhealthy" ? "异常" : "未知"}
              </Badge>
              {health()?.checked_at && (
                <span class="text-xs text-[var(--color-text-muted)] self-center">
                  检测于 {new Date(health()!.checked_at!).toLocaleString("zh-CN")}
                </span>
              )}
              {(data()!.mcp.tags ?? []).map((t) => (
                <Badge variant="info">{t}</Badge>
              ))}
            </div>
          </Card>
          <Card>
            <h3 class="font-semibold text-[var(--color-text-primary)] mb-2">工具列表</h3>
            {tools.loading && <Skeleton height={60} />}
            {tools()?.tools?.length ? (
              <div class="space-y-2">
                {tools()!.tools.map((t) => (
                  <div class="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-[var(--radius-md)] bg-[var(--color-muted)]">
                    <span class="font-mono text-sm">{t.tool}</span>
                    <div class="flex items-center gap-2">
                      <Badge variant="info">{t.calls} 次调用</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => notify("info", `工具 ${t.tool} 测试功能开发中`)}
                      >
                        测试
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !tools.loading && <p class="text-sm text-[var(--color-text-muted)]">暂无调用记录</p>}
          </Card>
          <Card>
            <h3 class="font-semibold text-[var(--color-text-primary)] mb-2">7 天用量趋势</h3>
            <TokenChart data={usageData()} loading={usage.loading} />
          </Card>
          <Card>
            <AuthorizationPanel
              mcpId={data()!.mcp.id}
              authorizations={data()!.authorizations ?? []}
              onRefresh={() => refetch()}
              canEdit={canEdit()}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
