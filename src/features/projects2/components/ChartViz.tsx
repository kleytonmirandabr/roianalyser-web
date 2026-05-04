import type { QueryResult, ChartType } from '../analytics-types'

interface Props {
  result: QueryResult
  chartType: ChartType
  color?: string
}

function BarChart({ rows, color }: { rows: Array<{ label: string; value: number }>; color: string }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  const W = 500, H = 200, PAD = 40, barGap = 4
  const barW = rows.length ? Math.max(8, (W - PAD * 2 - barGap * (rows.length - 1)) / rows.length) : 20
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full" style={{ maxHeight: 240 }}>
      {rows.map((r, i) => {
        const bh = Math.max(2, (r.value / max) * H)
        const x = PAD + i * (barW + barGap)
        const y = H - bh
        const label = String(r.label).slice(0, 10)
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} fill={color} rx={2} opacity={0.85} />
            <text x={x + barW / 2} y={H + 14} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.6}>{label}</text>
            <text x={x + barW / 2} y={y - 3} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.8}>{r.value}</text>
          </g>
        )
      })}
    </svg>
  )
}

function LineChart({ rows, color }: { rows: Array<{ label: string; value: number }>; color: string }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  const W = 500, H = 160, PAD = 30
  const pts = rows.map((r, i) => {
    const x = PAD + (i / Math.max(rows.length - 1, 1)) * (W - PAD * 2)
    const y = H - (r.value / max) * (H - 20)
    return { x, y, r }
  })
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ maxHeight: 200 }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} />
          <text x={p.x} y={p.y - 6} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.7}>{p.r.value}</text>
          <text x={p.x} y={H + 16} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.5}>{String(p.r.label).slice(0, 8)}</text>
        </g>
      ))}
    </svg>
  )
}

const PALETTE = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#a855f7','#14b8a6','#f97316']

function PieChart({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1
  const R = 80, cx = 110, cy = 95
  let angle = -Math.PI / 2
  const slices = rows.map((r, i) => {
    const frac = r.value / total
    const a1 = angle, a2 = angle + frac * 2 * Math.PI
    angle = a2
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1)
    const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2)
    const large = frac > 0.5 ? 1 : 0
    return { path: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`, color: PALETTE[i % PALETTE.length], label: r.label, value: r.value, frac }
  })
  return (
    <svg viewBox="0 0 260 190" className="w-full" style={{ maxHeight: 200 }}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth={1} opacity={0.9} />)}
      {slices.map((s, i) => (
        <g key={i}>
          <rect x={170} y={10 + i * 16} width={10} height={10} fill={s.color} rx={2} />
          <text x={184} y={19 + i * 16} fontSize={9} fill="currentColor" opacity={0.8}>{String(s.label).slice(0, 14)} ({s.value})</text>
        </g>
      ))}
    </svg>
  )
}

export function ChartViz({ result, chartType, color = '#6366f1' }: Props) {
  const rows = result.rows.map(r => ({
    label: String(r['_label'] ?? r[result.columns[0]?.key] ?? ''),
    value: Number(r['_value'] ?? r[result.columns[1]?.key] ?? 0),
  })).slice(0, 30)

  if (rows.length === 0) return <p className="text-xs text-muted-foreground text-center py-6">Sem dados</p>

  if (chartType === 'bar') return <BarChart rows={rows} color={color} />
  if (chartType === 'line') return <LineChart rows={rows} color={color} />
  if (chartType === 'pie') return <PieChart rows={rows} />
  return null
}
