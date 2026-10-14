import {
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartDataset,
  type Plugin,
  type PointStyle,
  type TooltipItem,
} from 'chart.js'
import { useEffect, useRef } from 'react'
import { useTheme } from '../../state/theme.tsx'
import { cssVar } from './methods.ts'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

export interface Series {
  label: string
  values: (number | null)[]
  colorVar: string
  pointStyle: PointStyle
  dashed?: boolean
  /** 水平參考線（不畫點）。 */
  baseline?: boolean
  /** 點半徑（預設 4.5）；多條線重疊時以同心的大小區分。 */
  radius?: number
  /** 繪製順序：數字小的畫在上層。 */
  order?: number
}

interface Props {
  labels: string[]
  series: Series[]
  /** 目前 k 的索引（0 起算）；null 時不標示。 */
  markerIndex: number | null
  yLabel: string
  format: (v: number) => string
  ariaLabel: string
}

const markerPlugin: Plugin<'line', { index: number | null; color: string; label: string }> = {
  id: 'kMarker',
  beforeDatasetsDraw(chart, _args, opts) {
    if (opts.index == null) return
    const { ctx, chartArea, scales } = chart
    const x = scales.x.getPixelForValue(opts.index)
    ctx.save()
    ctx.strokeStyle = opts.color
    ctx.lineWidth = 1
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = opts.color
    ctx.font = `600 12px ${cssVar('--font-mono')}`
    ctx.textAlign = x > chartArea.right - 60 ? 'right' : 'left'
    ctx.fillText(opts.label, x + (ctx.textAlign === 'right' ? -6 : 6), chartArea.top + 12)
    ctx.restore()
  },
}

export function LineChart({ labels, series, markerIndex, yLabel, format, ariaLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { resolved } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ink = cssVar('--ink')
    const ink2 = cssVar('--ink-2')
    const muted = cssVar('--muted')
    const grid = cssVar('--grid')
    const hair = cssVar('--hair')
    const paper = cssVar('--paper-raised')
    const mono = cssVar('--font-mono')
    const sans = cssVar('--font-sans')

    const datasets: ChartDataset<'line', (number | null)[]>[] = series.map((s) => {
      const color = cssVar(s.colorVar)
      return {
        label: s.label,
        data: s.values,
        borderColor: color,
        backgroundColor: s.dashed ? paper : color,
        borderWidth: 2,
        borderDash: s.dashed || s.baseline ? [6, 4] : [],
        pointStyle: s.baseline ? 'line' : s.pointStyle,
        pointRadius: s.baseline ? 0 : (s.radius ?? 4.5),
        pointHoverRadius: (s.radius ?? 4.5) + 1.5,
        order: s.order ?? 0,
        pointBorderWidth: 2,
        pointHitRadius: 12,
        spanGaps: false,
        tension: 0,
      }
    })

    const chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      plugins: [markerPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 4, right: 8 } },
        scales: {
          x: {
            title: { display: true, text: '特徵數 k', color: muted, font: { family: sans, size: 12 } },
            grid: { display: false },
            border: { color: hair },
            ticks: { color: ink2, font: { family: mono, size: 12 } },
          },
          y: {
            title: { display: true, text: yLabel, color: muted, font: { family: sans, size: 12 } },
            grid: { color: grid },
            border: { display: false },
            ticks: { color: ink2, font: { family: mono, size: 11 }, callback: (v) => format(Number(v)), maxTicksLimit: 6 },
          },
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'start',
            labels: { usePointStyle: true, boxHeight: 8, color: ink, font: { family: sans, size: 12 }, padding: 14 },
          },
          tooltip: {
            backgroundColor: cssVar('--paper-raised'),
            titleColor: ink,
            bodyColor: ink,
            borderColor: hair,
            borderWidth: 1,
            titleFont: { family: sans, weight: 600 },
            bodyFont: { family: mono, size: 12 },
            usePointStyle: true,
            boxPadding: 4,
            callbacks: {
              title: (items: TooltipItem<'line'>[]) => `k = ${items[0]?.label}`,
              label: (item: TooltipItem<'line'>) => {
                const v = item.parsed.y
                return ` ${v == null ? '無法估計' : format(v)}  ${item.dataset.label}`
              },
            },
          },
          kMarker: { index: markerIndex, color: cssVar('--accent'), label: markerIndex == null ? '' : `目前 k = ${labels[markerIndex]}` },
        } as never,
      },
    })
    return () => chart.destroy()
  }, [labels, series, markerIndex, yLabel, format, resolved])

  return (
    <div style={{ position: 'relative', height: 300 }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  )
}
