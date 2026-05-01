/**
 * Editor inline pra valor de coluna custom (Phase 2 P.4).
 * Suporta 9 tipos: text, number, currency, percent, date, select, checkbox, link, status.
 */
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
    default:
      return <span className="text-xs truncate">{String(value)}</span>
  }
}
