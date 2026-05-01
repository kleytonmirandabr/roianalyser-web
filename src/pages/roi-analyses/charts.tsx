/**
 * SVG charts vanilla pra ROI detail page (Sprint #238).
 *
 * - CumulativeCashFlowChart: linha do saldo acumulado mês a mês,
 *   com marcador vertical no mês de payback.
 * - MonthlyCashFlowChart: barras empilhadas (inflow + / outflow & investment −)
 *   com tooltip on hover.
 *
 * Sem dependência nova — Tailwind classes pra cores e tipografia.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/shared/lib/format'
import type { MonthlyFlow } from '@/features/roi-analyses/types'

const VB_W = 1200
const VB_H = 360
const PAD_L = 64
const PAD_R = 16
const PAD_T = 16
const PAD_B = 28

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min]
  const range = max - min
  const rough = range / count
  const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough || 1))))
  const norm = rough / pow
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * pow
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(2)))
  return out
}

function formatShort(v: number, currency: string): string {
  // Para eixo Y — abreviado quando passa de mil
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)    return `${(v / 1_000).toFixed(0)}k`
  return formatCurrency(v, currency, { compact: true })
}

/* ───────────────────── Cumulative cash flow ───────────────────── */

export function CumulativeCashFlowChart({
  data,
  currency,
  paybackMonth,
}: {
  data: MonthlyFlow[]
  currency: string
  paybackMonth: number | null
}) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)

  const points = useMemo(() => {
    if (data.length === 0) return null
    const xs = data.map(d => d.month)
    const ys = data.map(d => d.cumulative)
    const yMin = Math.min(0, ...ys)
    const yMax = Math.max(0, ...ys)
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    const innerW = VB_W - PAD_L - PAD_R
    const innerH = VB_H - PAD_T - PAD_B
    const xScale = (x: number) => PAD_L + ((x - xMin) / Math.max(1, xMax - xMin)) * innerW
    const yScale = (y: number) => PAD_T + (1 - (y - yMin) / Math.max(1, yMax - yMin)) * innerH
    const yZero = yScale(0)
    // Gera segmentos coloridos: verde quando cumulativo >= 0, vermelho quando negativo.
    // Cada segmento entre dois pontos consecutivos é um <path> separado.
    const segments: { d: string; positive: boolean }[] = []
    const areaSegments: { d: string; positive: boolean }[] = []
    for (let i = 1; i < data.length; i++) {
      const a = data[i - 1]
      const b = data[i]
      const x1 = xScale(a.month)
      const x2 = xScale(b.month)
      const y1 = yScale(a.cumulative)
      const y2 = yScale(b.cumulative)
      const aPos = a.cumulative >= 0
      const bPos = b.cumulative >= 0
      if (aPos === bPos) {
        segments.push({ d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`, positive: aPos })
        areaSegments.push({
          d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x2.toFixed(1)} ${yZero.toFixed(1)} L ${x1.toFixed(1)} ${yZero.toFixed(1)} Z`,
          positive: aPos,
        })
      } else {
        // Cruzou o zero — calcular ponto de cruzamento por interpolação linear
        const t = a.cumulative / (a.cumulative - b.cumulative)
        const xc = x1 + (x2 - x1) * t
        segments.push({ d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${xc.toFixed(1)} ${yZero.toFixed(1)}`, positive: aPos })
        segments.push({ d: `M ${xc.toFixed(1)} ${yZero.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`, positive: bPos })
        areaSegments.push({
          d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${xc.toFixed(1)} ${yZero.toFixed(1)} L ${x1.toFixed(1)} ${yZero.toFixed(1)} Z`,
          positive: aPos,
        })
        areaSegments.push({
          d: `M ${xc.toFixed(1)} ${yZero.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x2.toFixed(1)} ${yZero.toFixed(1)} Z`,
          positive: bPos,
        })
      }
    }
    const yTicks = niceTicks(yMin, yMax, 4)
    return { xScale, yScale, yZero, segments, areaSegments, yMin, yMax, xMin, xMax, yTicks }
  }, [data])

  if (!points || data.length === 0) {
    return <EmptyState label={t('roiAnalyses.charts.empty', 'Sem dados pra exibir.')} />
  }

  const hovered = hover != null ? data[hover] : null
  const hoverX = hovered ? points.xScale(hovered.month) : 0
  const hoverY = hovered ? points.yScale(hovered.cumulative) : 0

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{t('roiAnalyses.charts.cumulative.title', 'Saldo acumulado')}</h3>
        {paybackMonth != null && (
          <span className="text-xs text-muted-foreground">
            {t('roiAnalyses.charts.cumulative.paybackAt', 'Payback no mês')} <span className="font-medium text-foreground">{paybackMonth}</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" style={{ maxHeight: 420 }}
        onMouseLeave={() => setHover(null)}>
        {/* grid + Y ticks */}
        {points.yTicks.map((y, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={VB_W - PAD_R} y1={points.yScale(y)} y2={points.yScale(y)}
              className="stroke-muted-foreground/20" strokeDasharray={y === 0 ? '' : '2 3'} strokeWidth={y === 0 ? 1.5 : 1} />
            <text x={PAD_L - 6} y={points.yScale(y) + 3} className="fill-muted-foreground text-[10px]" textAnchor="end">
              {formatShort(y, currency)}
            </text>
          </g>
        ))}

        {/* X axis ticks — TODOS os meses */}
        {data.map((d, i) => (
          <text key={i} x={points.xScale(d.month)} y={VB_H - PAD_B + 14}
            className="fill-muted-foreground text-[9px]" textAnchor="middle">
            m{d.month}
          </text>
        ))}

        {/* Payback marker */}
        {paybackMonth != null && (
          <line x1={points.xScale(paybackMonth)} x2={points.xScale(paybackMonth)} y1={PAD_T} y2={VB_H - PAD_B}
            className="stroke-emerald-600/60" strokeDasharray="3 3" strokeWidth={1} />
        )}

        {/* Area fill — verde quando saldo positivo, vermelho quando negativo */}
        {points.areaSegments.map((s, i) => (
          <path key={`a${i}`} d={s.d} className={s.positive ? 'fill-emerald-500/15' : 'fill-rose-500/20'} />
        ))}
        {/* Line — mesmo esquema */}
        {points.segments.map((s, i) => (
          <path key={`s${i}`} d={s.d} className={s.positive ? 'stroke-emerald-600 fill-none' : 'stroke-rose-600 fill-none'} strokeWidth={2} />
        ))}

        {/* Hover overlay (transparent rects pra capturar mouse) */}
        {data.map((d, i) => (
          <rect key={i}
            x={points.xScale(d.month) - 8} y={PAD_T} width={16} height={VB_H - PAD_T - PAD_B}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}

        {/* Hover dot + label */}
        {hovered && (
          <>
            <line x1={hoverX} x2={hoverX} y1={PAD_T} y2={VB_H - PAD_B} className="stroke-foreground/30" strokeWidth={1} />
            <circle cx={hoverX} cy={hoverY} r={4} className={hovered.cumulative >= 0 ? "fill-emerald-600 stroke-background" : "fill-rose-600 stroke-background"} strokeWidth={1.5} />
            <g transform={`translate(${Math.min(hoverX + 8, VB_W - 140)},${Math.max(hoverY - 38, PAD_T)})`}>
              <rect width={132} height={34} rx={4} className="fill-background stroke-border" />
              <text x={6} y={14} className="fill-muted-foreground text-[10px]">m{hovered.month}</text>
              <text x={6} y={28} className="fill-foreground text-[11px] font-medium">{formatCurrency(hovered.cumulative, currency)}</text>
            </g>
          </>
        )}
      </svg>
    </div>
  )
}

/* ───────────────────── Monthly cash flow ───────────────────── */

export function MonthlyCashFlowChart({
  data,
  currency,
}: {
  data: MonthlyFlow[]
  currency: string
}) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)

  const points = useMemo(() => {
    if (data.length === 0) return null
    const xs = data.map(d => d.month)
    const ups = data.map(d => d.inflow)
    const downs = data.map(d => -(d.outflow + d.investment))
    const yMax = Math.max(0, ...ups)
    const yMin = Math.min(0, ...downs)
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    const innerW = VB_W - PAD_L - PAD_R
    const innerH = VB_H - PAD_T - PAD_B
    const barW = Math.max(4, (innerW / (xMax - xMin + 1)) - 2)
    const xCenter = (x: number) => PAD_L + ((x - xMin) / Math.max(1, xMax - xMin + 1)) * innerW + (innerW / (xMax - xMin + 1)) / 2
    const yScale = (y: number) => PAD_T + (1 - (y - yMin) / Math.max(1, yMax - yMin)) * innerH
    const yZero = yScale(0)
    const yTicks = niceTicks(yMin, yMax, 4)
    return { yScale, yZero, xCenter, barW, yMin, yMax, xMin, xMax, yTicks }
  }, [data])

  if (!points || data.length === 0) {
    return <EmptyState label={t('roiAnalyses.charts.empty', 'Sem dados pra exibir.')} />
  }

  const hovered = hover != null ? data[hover] : null

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{t('roiAnalyses.charts.monthly.title', 'Fluxo mensal')}</h3>
        <div className="flex gap-3 text-[10px]">
          <Legend color="bg-emerald-500" label={t('common.fields.totalRevenue', 'Receita')} />
          <Legend color="bg-rose-500"    label={t('common.fields.totalCost', 'Custo')} />
          <Legend color="bg-blue-500"    label={t('roiAnalyses.kpi.investment', 'Investimento')} />
        </div>
      </div>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" style={{ maxHeight: 420 }}
        onMouseLeave={() => setHover(null)}>
        {/* Y grid */}
        {points.yTicks.map((y, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={VB_W - PAD_R} y1={points.yScale(y)} y2={points.yScale(y)}
              className="stroke-muted-foreground/20" strokeDasharray={y === 0 ? '' : '2 3'} strokeWidth={y === 0 ? 1.5 : 1} />
            <text x={PAD_L - 6} y={points.yScale(y) + 3} className="fill-muted-foreground text-[10px]" textAnchor="end">
              {formatShort(y, currency)}
            </text>
          </g>
        ))}

        {/* X axis ticks — TODOS os meses */}
        {data.map((d, i) => (
          <text key={i} x={points.xCenter(d.month)} y={VB_H - PAD_B + 14}
            className="fill-muted-foreground text-[9px]" textAnchor="middle">
            m{d.month}
          </text>
        ))}

        {/* Barras */}
        {data.map((d, i) => {
          const cx = points.xCenter(d.month)
          const halfW = points.barW / 2
          // Em SVG y cresce pra baixo; yScale(0) é a linha do zero.
          // Positivo (inflow) → topo em yScale(inflow), altura até yScale(0).
          // Negativos (outflow, investment) → empilhados pra baixo do zero.
          const yZero = points.yScale(0)
          // Inflow (verde, acima do zero)
          const inflowTop = points.yScale(d.inflow)
          const inflowH = yZero - inflowTop
          // Outflow começa em y=0 e vai pra baixo
          const outflowTop = yZero
          const outflowBottom = points.yScale(-d.outflow)
          const outflowH = outflowBottom - outflowTop
          // Investment empilhado abaixo do outflow
          const invTop = outflowBottom
          const invBottom = points.yScale(-(d.outflow + d.investment))
          const invH = invBottom - invTop
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              {d.inflow > 0 && (
                <rect x={cx - halfW} y={inflowTop} width={points.barW} height={Math.max(0, inflowH)}
                  className="fill-emerald-500" rx={1} />
              )}
              {d.outflow > 0 && (
                <rect x={cx - halfW} y={outflowTop} width={points.barW} height={Math.max(0, outflowH)}
                  className="fill-rose-500" rx={1} />
              )}
              {d.investment > 0 && (
                <rect x={cx - halfW} y={invTop} width={points.barW} height={Math.max(0, invH)}
                  className="fill-blue-500" rx={1} />
              )}
              {/* Hover hitbox */}
              <rect x={cx - halfW - 1} y={PAD_T} width={points.barW + 2} height={VB_H - PAD_T - PAD_B}
                fill="transparent" />
            </g>
          )
        })}

        {/* Tooltip */}
        {hovered && (
          <g transform={`translate(${Math.min(points.xCenter(hovered.month) + 8, VB_W - 180)},${PAD_T + 4})`}>
            <rect width={172} height={68} rx={4} className="fill-background stroke-border" />
            <text x={8} y={14} className="fill-muted-foreground text-[10px]">m{hovered.month}</text>
            <g className="text-[10px]">
              <Row y={26} label={t('common.fields.totalRevenue', 'Receita')} value={formatCurrency(hovered.inflow, currency)} dotClass="fill-emerald-500" />
              <Row y={40} label={t('common.fields.totalCost', 'Custo')}    value={formatCurrency(hovered.outflow, currency)} dotClass="fill-rose-500" />
              <Row y={54} label={t('roiAnalyses.kpi.investment', 'Investimento')} value={formatCurrency(hovered.investment, currency)} dotClass="fill-blue-500" />
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}

/* ───────────────────── Subcomponentes ───────────────────── */

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function Row({ y, label, value, dotClass }: { y: number; label: string; value: string; dotClass: string }) {
  return (
    <g>
      <circle cx={12} cy={y - 3} r={3} className={dotClass} />
      <text x={20} y={y} className="fill-muted-foreground">{label}</text>
      <text x={164} y={y} textAnchor="end" className="fill-foreground font-medium tabular-nums">{value}</text>
    </g>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{label}</div>
  )
}
