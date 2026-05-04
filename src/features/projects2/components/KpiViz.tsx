import type { QueryResult } from '../analytics-types'

interface Props {
  result: QueryResult
  kpiField?: string
  kpiLabel?: string
  color?: string
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function KpiViz({ result, kpiField, kpiLabel, color = '#6366f1' }: Props) {
  const valueKey = kpiField ?? '_value' ?? result.columns[0]?.key
  const total = result.rows.reduce((s, r) => s + Number(r[valueKey] ?? 0), 0)
  const label = kpiLabel ?? result.columns.find(c => c.key === valueKey)?.label ?? 'Total'

  return (
    <div className="flex flex-col items-center justify-center py-6 gap-1">
      <p className="text-4xl font-bold" style={{ color }}>{formatNumber(total)}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground opacity-60">{result.total} registros</p>
    </div>
  )
}
