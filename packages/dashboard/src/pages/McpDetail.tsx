import { createResource, createSignal, Show, For } from "solid-js"
import { useParams, A } from "@solidjs/router"
import { api } from "../lib/api"
import { Card } from "../components/ui/Card"
import { Badge } from "../components/ui/Badge"
import { Skeleton } from "../components/ui/Skeleton"
import { Modal } from "../components/ui/Modal"
import { Input } from "../components/ui/Input"
import { TokenChart } from "../components/dashboard/TokenChart"
import { Button } from "../components/ui/Button"
import { user } from "../stores/auth"
import { notify } from "../stores/notification"

type McpInfo = {
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

type Member = {
  user_id: string
  user_name?: string
  role: string
  joined_at?: string
}

type Application = {
  id: string
  user_id: string
  user_name?: string
  reason?: string
  status: string
  created_at?: string
}

type DetailTab = "info" | "members"

export default function McpDetail() {
  const params = useParams()
  const id = () => params.id
  const [tab, setTab] = createSignal<DetailTab>("info")
  const [showApply, setShowApply] = createSignal(false)
  const [reason, setReason] = createSignal("")
  const [applying, setApplying] = createSignal(false)
  const [applied, setApplied] = createSignal(false)
  const [showInvite, setShowInvite] = createSignal(false)
  const [inviteIds, setInviteIds] = createSignal("")
  const [inviting, setInviting] = createSignal(false)

  const [data, { refetch }] = createResource(id, (i) =>
    api.get<{ mcp: McpInfo }>(`/mcp/${i}`)
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
  const [members, { refetch: refetchMembers }] = createResource(id, (i) =>
    api.get<{ members: Member[] }>(`/mcp/${i}/members`).catch(() => ({ members: [] as Member[] }))
  )
  const [apps, { refetch: refetchApps }] = createResource(
    () => (canEdit() ? id() : undefined),
    (i) => api.get<{ applications: Application[] }>(`/mcp/${i}/applications`).catch(() => ({ applications: [] as Application[] }))
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

  const isMember = () => {
    const u = user()
    if (!u) return false
    return (members()?.members ?? []).some((m) => m.user_id === u.id)
  }

  const submitApply = async () => {
    setApplying(true)
    await api.post(`/mcp/${id()}/apply`, { reason: reason().trim() || undefined })
    notify("success", "申请已提交，等待审批")
    setShowApply(false)
    setApplied(true)
    setApplying(false)
  }

  const handleApp = async (aid: string, approved: boolean) => {
    await api.put(`/mcp/${id()}/applications/${aid}`, { approved })
    notify("success", approved ? "已通过" : "已拒绝")
    refetchApps()
    refetchMembers()
  }

  const invite = async () => {
    const ids = inviteIds().split(",").map((s) => s.trim()).filter(Boolean)
    if (!ids.length) return notify("warning", "请输入用户 ID")
    setInviting(true)
    await api.post(`/mcp/${id()}/members`, { user_ids: ids, role: "user" })
    notify("success", "邀请成功")
    setShowInvite(false)
    setInviteIds("")
    setInviting(false)
    refetchMembers()
  }

  const changeRole = async (uid: string, role: string) => {
    await api.put(`/mcp/${id()}/members`, { user_id: uid, role })
    notify("success", "角色已更新")
    refetchMembers()
  }

  const removeMember = async (uid: string) => {
    await api.del(`/mcp/${id()}/members`, { user_id: uid })
    notify("success", "已移除成员")
    refetchMembers()
  }

  const tabCls = (t: DetailTab) =>
    `px-4 py-2 text-sm font-medium rounded-t-[var(--radius-md)] cursor-pointer transition-colors ${
      tab() === t
        ? "bg-[var(--color-bg-elevated)] text-[var(--color-primary)] border border-b-0 border-[var(--color-border)]"
        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
    }`

  const pending = () => (apps()?.applications ?? []).filter((a) => a.status === "pending")

  return (
    <div class="p-4 max-w-3xl mx-auto">
      <A href="/mcp" class="text-sm text-[var(--color-primary)] hover:underline mb-4 inline-block">
        ← 返回市场
      </A>
      <Show when={data.loading}>
        <Skeleton height={32} class="mb-4" />
        <Skeleton height={100} />
      </Show>
      <Show when={data.error}>
        <p class="text-[var(--color-error)]">加载失败: {String(data.error)}</p>
      </Show>
      <Show when={data()}>
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
              <Show when={health()?.checked_at}>
                <span class="text-xs text-[var(--color-text-muted)] self-center">
                  检测于 {new Date(health()!.checked_at!).toLocaleString("zh-CN")}
                </span>
              </Show>
              {(data()!.mcp.tags ?? []).map((t) => (
                <Badge variant="info">{t}</Badge>
              ))}
            </div>
            <Show when={!isMember() && data()!.mcp.visibility === "SHARED"}>
              <Show
                when={!applied()}
                fallback={<Badge variant="warning">申请已提交，等待审批</Badge>}
              >
                <Button variant="accent" size="sm" onClick={() => setShowApply(true)}>申请使用</Button>
              </Show>
            </Show>
          </Card>

          <div class="flex gap-1 border-b border-[var(--color-border)]">
            <button class={tabCls("info")} onClick={() => setTab("info")}>详情</button>
            <button class={tabCls("members")} onClick={() => setTab("members")}>成员管理</button>
          </div>

          <Show when={tab() === "info"}>
            <Card>
              <h3 class="font-semibold text-[var(--color-text-primary)] mb-2">工具列表</h3>
              <Show when={tools.loading}>
                <Skeleton height={60} />
              </Show>
              <Show when={tools()?.tools?.length} fallback={
                <Show when={!tools.loading}>
                  <p class="text-sm text-[var(--color-text-muted)]">暂无调用记录</p>
                </Show>
              }>
                <div class="space-y-2">
                  <For each={tools()!.tools}>{(t) => (
                    <div class="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-[var(--radius-md)] bg-[var(--color-muted)]">
                      <span class="font-mono text-sm">{t.tool}</span>
                      <Badge variant="info">{t.calls} 次调用</Badge>
                    </div>
                  )}</For>
                </div>
              </Show>
            </Card>
            <Card>
              <h3 class="font-semibold text-[var(--color-text-primary)] mb-2">7 天用量趋势</h3>
              <TokenChart data={usageData()} loading={usage.loading} />
            </Card>
          </Show>

          <Show when={tab() === "members"}>
            <Card>
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold text-[var(--color-text-primary)]">成员列表</h3>
                <Show when={canEdit()}>
                  <Button variant="accent" size="sm" onClick={() => setShowInvite(true)}>邀请成员</Button>
                </Show>
              </div>
              <Show when={members.loading}>
                <Skeleton height={60} />
              </Show>
              <Show when={(members()?.members ?? []).length} fallback={
                <Show when={!members.loading}>
                  <p class="text-sm text-[var(--color-text-muted)]">暂无成员</p>
                </Show>
              }>
                <div class="space-y-2">
                  <For each={members()!.members}>{(m) => (
                    <div class="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-[var(--radius-md)] bg-[var(--color-muted)]">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium">{m.user_name ?? m.user_id}</span>
                        <Badge variant={m.role === "owner" ? "warning" : m.role === "admin" ? "info" : "default"}>{m.role}</Badge>
                        <Show when={m.joined_at}>
                          <span class="text-xs text-[var(--color-text-muted)]">{new Date(m.joined_at!).toLocaleDateString("zh-CN")}</span>
                        </Show>
                      </div>
                      <Show when={canEdit() && m.role !== "owner"}>
                        <div class="flex items-center gap-1">
                          <select
                            class="h-7 px-2 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                            value={m.role}
                            onChange={(e) => changeRole(m.user_id, e.currentTarget.value)}
                          >
                            <option value="admin">admin</option>
                            <option value="user">user</option>
                          </select>
                          <Button variant="ghost" size="sm" onClick={() => removeMember(m.user_id)}>移除</Button>
                        </div>
                      </Show>
                    </div>
                  )}</For>
                </div>
              </Show>
            </Card>

            <Show when={canEdit() && pending().length}>
              <Card>
                <h3 class="font-semibold text-[var(--color-text-primary)] mb-3">待审批申请</h3>
                <div class="space-y-2">
                  <For each={pending()}>{(a) => (
                    <div class="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-[var(--radius-md)] bg-[var(--color-muted)]">
                      <div>
                        <span class="text-sm font-medium">{a.user_name ?? a.user_id}</span>
                        <Show when={a.reason}>
                          <span class="ml-2 text-xs text-[var(--color-text-muted)]">理由: {a.reason}</span>
                        </Show>
                        <Show when={a.created_at}>
                          <span class="ml-2 text-xs text-[var(--color-text-muted)]">{new Date(a.created_at!).toLocaleDateString("zh-CN")}</span>
                        </Show>
                      </div>
                      <div class="flex gap-1">
                        <Button variant="primary" size="sm" onClick={() => handleApp(a.id, true)}>通过</Button>
                        <Button variant="danger" size="sm" onClick={() => handleApp(a.id, false)}>拒绝</Button>
                      </div>
                    </div>
                  )}</For>
                </div>
              </Card>
            </Show>
          </Show>
        </div>

        <Modal open={showApply()} onClose={() => setShowApply(false)} title="申请使用" size="sm">
          <div class="space-y-3">
            <Input label="申请理由（可选）" value={reason()} onInput={setReason} placeholder="简要说明用途" />
            <div class="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowApply(false)}>取消</Button>
              <Button variant="accent" size="sm" loading={applying()} onClick={submitApply}>提交申请</Button>
            </div>
          </div>
        </Modal>

        <Modal open={showInvite()} onClose={() => setShowInvite(false)} title="邀请成员" size="sm">
          <div class="space-y-3">
            <Input label="用户 ID" value={inviteIds()} onInput={setInviteIds} placeholder="逗号分隔多个 ID" />
            <div class="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowInvite(false)}>取消</Button>
              <Button variant="accent" size="sm" loading={inviting()} onClick={invite}>邀请</Button>
            </div>
          </div>
        </Modal>
      </Show>
    </div>
  )
}
