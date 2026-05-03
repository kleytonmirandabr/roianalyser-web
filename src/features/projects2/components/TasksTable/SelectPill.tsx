import type { ProjectTaskColumn } from '@/features/projects2/task-columns-types'
import { PILL_PALETTE } from './helpers'

interface Props {
  column: ProjectTaskColumn
  value: any
}

export function SelectPill({ column, value }: Props) {
  if (!value) return null
  const opts = column.options?.values || []
  const opt  = opts.find(o => o.value === value)
  if (!opt) return <span className="text-xs text-muted-foreground">{value}</span>

  const colorClass = opt.color ? '' : PILL_PALETTE[opts.indexOf(opt) % PILL_PALETTE.length]
  return (
    <span
      className={`text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${colorClass}`}
      style={opt.color ? { backgroundColor: opt.color + '30', color: opt.color } : undefined}
    >
      {opt.label}
    </span>
  )
}
