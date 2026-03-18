import { onMount, onCleanup, createEffect } from "solid-js"
import * as echarts from "echarts"

type Point = { day: string; tokens_in: number; tokens_out: number }

type Props = {
  data: Point[]
  loading?: boolean
}

export function TokenChart(props: Props) {
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
    if (!chart || !d?.length) return
    const option: echarts.EChartsOption = {
      tooltip: { trigger: "axis" },
      legend: { data: ["输入", "输出"], bottom: 0 },
      grid: { left: "3%", right: "4%", bottom: "15%", top: "10%", containLabel: true },
      xAxis: {
        type: "category",
        data: d.map((p) => p.day),
        axisLabel: { formatter: (v: string) => v.slice(5) },
      },
      yAxis: { type: "value", splitLine: { lineStyle: { color: "var(--color-border)" } } },
      series: [
        { name: "输入", type: "line", data: d.map((p) => p.tokens_in), smooth: true },
        { name: "输出", type: "line", data: d.map((p) => p.tokens_out), smooth: true },
      ],
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
