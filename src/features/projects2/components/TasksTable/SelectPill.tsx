import { useState } from 'react'
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

  const i = opts.indexOf(opt)
  const colorClass = opt.color ? '' : PILL_PALETTE[i % PILL_PALETTE.length]
  return (
    <span
      className={`text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${colorClass}`}
      style={opt.color ? { backgroundColor: opt.color + '30', color: opt.color } : undefined}
    >
      {opt.label}
    </span>
  )
}

/** Pill clicável — mostra cor e abre dropdown para editar. */
export function SelectPillEditor({ column, value, onChange }: {
  column: ProjectTaskColumn
  value: any
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const opts = column.options?.values || []
  const sel  = opts.find(o => o.value === value)

  function pillStyle(o: { value: string; label: string; color?: string }, i: number) {
    const colorClass = o.color ? '' : PILL_PALETTE[i % PILL_PALETTE.length]
    const style = o.color ? { backgroundColor: o.color + '30', color: o.color } : undefined
    return { colorClass, style }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="hover:opacity-80 transition-opacity focus:outline-none"
      >
        {sel ? (() => {
          const { colorClass, style } = pillStyle(sel, opts.indexOf(sel))
          return (
            <span
              className={`text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap cursor-pointer ${colorClass}`}
              style={style}
            >{sel.label}</span>
          )
        })() : (
          <span className="text-xs text-muted-foreground px-1 py-0.5 rounded border border-dashed cursor-pointer hover:border-foreground/30 transition-colors">—</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-50 mt-1 bg-popover border rounded-md shadow-lg py-1 min-w-[130px]">
            <button type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50">
              — Nenhum
            </button>
            {opts.map((o, i) => {
              const { colorClass, style } = pillStyle(o, i)
              return (
                <button key={o.value} type="button"
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className="w-full text-left px-3 py-1.5 hover:bg-muted/50 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${colorClass}`}
                    style={style}
                  >{o.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
