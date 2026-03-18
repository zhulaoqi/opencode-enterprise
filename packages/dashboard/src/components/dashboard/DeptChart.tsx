import { onMount, onCleanup, createEffect } from "solid-js"
import * as echarts from "echarts"

type Point = { scope_id: string; tokens: number }

type Props = {
  data: Point[]
  loading?: boolean
}

export function DeptChart(props: Props) {
  let el: HTMLDivElement
  let chart: echarts.ECharts | null = null

  onMount(() => {
    chart = echarts.init(el)
    const resize = () => chart?.resize()
    window.addEventListener("resize", resize)
    onCleanup(() => {
      window.removeEventListener("resize", resize)
      chart?.dispose()
    })
  })

  createEffect(() => {
    const d = props.data
    if (!chart) return
    if (!d?.length) {
      chart.setOption({})
      return
    }
    const sorted = [...d].sort((a, b) => Number(b.tokens) - Number(a.tokens)).slice(0, 10)
    const option: echarts.EChartsOption = {
      tooltip: { trigger: "axis" },
      grid: { left: "15%", right: "10%", bottom: "5%", top: "5%", containLabel: true },
      xAxis: { type: "value", splitLine: { lineStyle: { color: "var(--color-border)" } } },
      yAxis: {
        type: "category",
        data: sorted.map((p) => p.scope_id || "未分配"),
        axisLabel: { width: 80, overflow: "truncate" },
      },
      series: [{ type: "bar", data: sorted.map((p) => Number(p.tokens)), itemStyle: { color: "var(--color-primary)" } }],
    }
    chart.setOption(option)
  })

  return (
    <div class="w-full h-64 relative">
      {props.loading && (
        <div class="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-elevated)]/90 text-[var(--color-text-muted)] z-10">
          加载中...
        </div>
      )}
      <div ref={(e) => (el = e)} class="w-full h-full" />
    </div>
  )
}
