/**
 * Editor inline pra valor de coluna custom (Phase 2 P.4).
 * Suporta 9 tipos: text, number, currency, percent, date, select, checkbox, link, status.
 */
import { Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import type { ProjectTaskColumn } from '@/features/projects2/task-columns-types'

interface Props {
  column: ProjectTaskColumn
  value: any
  onChange: (newValue: any) => void
  disabled?: boolean
}

function fmtCurrency(n: number, cur = 'BRL'): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur }).format(n)
  } catch { return String(n) }
}

export function ColumnCellEditor({ column, value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState<any>(value ?? '')
  useEffect(() => { setDraft(value ?? '') }, [value])

  function commit(next: any) {
    if (next !== value) onChange(next)
  }

  switch (column.type) {
    case 'text':
    case 'long_text':
      return (
        <Input
          value={draft || ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft || null)}
          disabled={disabled}
          className="h-7 text-xs"
          placeholder="-"
        />
      )

    case 'number':
      return (
        <Input
          type="number"
          value={draft ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft === '' ? null : Number(draft))}
          disabled={disabled}
          className="h-7 text-xs w-24"
        />
      )

    case 'currency':
      return (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">R$</span>
          <Input
            type="number"
            step="0.01"
            value={draft ?? ''}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft === '' ? null : Number(draft))}
            disabled={disabled}
            className="h-7 text-xs w-24"
          />
        </div>
      )

    case 'percent':
    case 'progress':
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={100}
            value={draft ?? ''}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft === '' ? null : Math.max(0, Math.min(100, Number(draft))))}
            disabled={disabled}
            className="h-7 text-xs w-16"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      )

    case 'date':
      return (
        <Input
          type="date"
          value={draft || ''}
          onChange={(e) => { setDraft(e.target.value); commit(e.target.value || null) }}
          disabled={disabled}
          className="h-7 text-xs"
        />
      )

    case 'date_range': {
      const v = (value && typeof value === 'object') ? value as { start?: string; end?: string } : {}
      return (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={v.start || ''}
            onChange={(e) => commit({ ...v, start: e.target.value || null })}
            disabled={disabled}
            className="h-7 px-1.5 text-xs rounded border bg-background w-28"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <input
            type="date"
            value={v.end || ''}
            onChange={(e) => commit({ ...v, end: e.target.value || null })}
            disabled={disabled}
            className="h-7 px-1.5 text-xs rounded border bg-background w-28"
          />
        </div>
      )
    }

    case 'select':
    case 'status': {
      const opts = (column.options?.values || []).map(o => ({ value: o.value, label: o.label }))
      return (
        <Combobox
          options={opts}
          value={value || ''}
          onChange={(v) => commit(v || null)}
          disabled={disabled}
          placeholder="-"
        />
      )
    }

    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => commit(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4"
        />
      )

    case 'rating': {
      const n = Number(value) || 0
      return (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => commit(i === n ? 0 : i)}
              className="text-amber-500 hover:scale-110 transition-transform disabled:cursor-not-allowed"
              title={`${i} de 5`}
            >
              <Star className={`h-3.5 w-3.5 ${i <= n ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/40'}`} />
            </button>
          ))}
        </div>
      )
    }

    case 'link':
      return (
        <Input
          type="url"
          value={draft || ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft || null)}
          disabled={disabled}
          className="h-7 text-xs"
          placeholder="https://"
        />
      )

    default:
      // tipos nao implementados ainda renderam só read-only
      return (
        <span className="text-xs text-muted-foreground italic">
          {value !== null && value !== undefined ? JSON.stringify(value).slice(0, 30) : '-'}
        </span>
      )
  }
}

/** Versao readonly compacta — usada quando quem ve nao pode editar. */
export function ColumnCellReadonly({ column, value }: { column: ProjectTaskColumn; value: any }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  switch (column.type) {
    case 'currency':
      return <span className="text-xs tabular-nums">{fmtCurrency(Number(value))}</span>
    case 'percent':
    case 'progress':
      return <span className="text-xs tabular-nums">{value}%</span>
    case 'checkbox':
      return <span className="text-xs">{value ? '✓' : '-'}</span>
    case 'select':
    case 'status': {
      const opt = column.options?.values?.find(o => o.value === value)
      return <span className="text-xs">{opt?.label || value}</span>
    }
    case 'link':
      return <a href={value} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate">{value}</a>
    case 'date':
      try { return <span className="text-xs">{new Date(value).toLocaleDateString('pt-BR')}</span> }
      catch { return <span className="text-xs">{String(value)}</span> }
    case 'date_range': {
      const v = (value && typeof value === 'object') ? value as { start?: string; end?: string } : {}
      function fmt(s?: string): string {
        if (!s) return '?'
        try { return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }
        catch { return s }
      }
      const today = new Date().toISOString().slice(0, 10)
      const isLate = v.end && v.end < today
      const tone = isLate
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      return (
        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded ${tone}`}>
          {isLate && <span className="mr-1">!</span>}
          {fmt(v.start)} - {fmt(v.end)}
        </span>
      )
    }
    case 'rating': {
      const n = Number(value) || 0
      return (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} className={`h-3 w-3 ${i <= n ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/40'}`} />
          ))}
        </div>
      )
    }
    default:
      return <span className="text-xs truncate">{String(value)}</span>
  }
}
