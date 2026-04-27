/**
 * Filtros avançados (query builder) pra Projetos.
 *
 * UI:
 *   - Botão "+ Adicionar filtro" abre dropdown com campos disponíveis.
 *   - Cada filtro vira um chip empilhado: [Campo] [Operador ▾] [Valor] [×]
 *   - Operadores variam por tipo de campo (text, number, date, select).
 *   - "Entre" mostra dois campos de valor (between).
 *   - "Vazio"/"Não vazio" não mostram input.
 *
 * Integração: lib aplica os filtros via `applyFilters(projects, state.filters)`.
 * Componente é portable — Lista, Kanban e Funil usam o mesmo state.
 */
import { Filter as FilterIcon, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  PROJECT_FIELDS,
  PROJECT_FIELDS_BY_KEY,
  newFilter,
  type Filter,
  type FilterOperator,
} from '@/features/projects/lib/project-fields'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

/** Hook simples — só guarda o array em estado React. Sem persistência. */
export function useAdvancedFilters() {
  const [filters, setFilters] = useState<Filter[]>([])
  const add = useCallback((fieldKey: string) => {
    setFilters((prev) => [...prev, newFilter(fieldKey)])
  }, [])
  const update = useCallback((id: string, patch: Partial<Filter>) => {
    setFilters((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const next = { ...f, ...patch }
        // Se mudou o fieldKey, reseta o operador pra um válido do novo tipo.
        if (patch.fieldKey && patch.fieldKey !== f.fieldKey) {
          const def = PROJECT_FIELDS_BY_KEY[patch.fieldKey]
          if (def && !OPERATORS_BY_TYPE[def.type].includes(next.operator)) {
            next.operator = OPERATORS_BY_TYPE[def.type][0]
          }
          next.value = ''
          next.value2 = ''
        }
        return next
      }),
    )
  }, [])
  const remove = useCallback((id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }, [])
  const clear = useCallback(() => setFilters([]), [])
  return { filters, add, update, remove, clear }
}

export function AdvancedFilters({
  state,
}: {
  state: ReturnType<typeof useAdvancedFilters>
}) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.filters.map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          onChange={(patch) => state.update(filter.id, patch)}
          onRemove={() => state.remove(filter.id)}
        />
      ))}

      <div ref={pickerRef} className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen((v) => !v)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">
            {t('projects.advancedFilters.add', {
              defaultValue: 'Adicionar filtro',
            })}
          </span>
        </Button>

        {pickerOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
              {t('projects.advancedFilters.fieldPickerTitle', {
                defaultValue: 'Filtrar por...',
              })}
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {PROJECT_FIELDS.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    state.add(field.key)
                    setPickerOpen(false)
                  }}
                >
                  <span className="truncate">{field.label}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {field.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {state.filters.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={state.clear}
          className="gap-1 text-xs text-muted-foreground"
        >
          <FilterIcon className="h-3 w-3" />
          {t('projects.advancedFilters.clearAll', {
            defaultValue: 'Limpar todos',
          })}
        </Button>
      )}
    </div>
  )
}

function FilterChip({
  filter,
  onChange,
  onRemove,
}: {
  filter: Filter
  onChange: (patch: Partial<Filter>) => void
  onRemove: () => void
}) {
  const def = PROJECT_FIELDS_BY_KEY[filter.fieldKey]
  if (!def) return null
  const operators = OPERATORS_BY_TYPE[def.type]
  const opNeedsValue =
    filter.operator !== 'empty' && filter.operator !== 'notEmpty'
  const opNeedsTwoValues = filter.operator === 'between'

  // Tipo do input HTML conforme tipo do campo.
  const inputType =
    def.type === 'date' ? 'date' : def.type === 'number' ? 'number' : 'text'

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1">
      {/* Campo */}
      <select
        value={filter.fieldKey}
        onChange={(e) => onChange({ fieldKey: e.target.value })}
        className="h-7 rounded bg-background px-1 text-xs font-medium"
        title="Campo"
      >
        {PROJECT_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operador */}
      <select
        value={filter.operator}
        onChange={(e) =>
          onChange({ operator: e.target.value as FilterOperator })
        }
        className="h-7 rounded bg-background px-1 text-xs text-muted-foreground"
        title="Operador"
      >
        {operators.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>

      {/* Valor(es) */}
      {opNeedsValue && (
        <>
          {def.type === 'boolean' ? (
            <select
              value={filter.value || 'true'}
              onChange={(e) => onChange({ value: e.target.value })}
              className="h-7 rounded bg-background px-1 text-xs"
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          ) : (
            <Input
              type={inputType}
              value={filter.value}
              onChange={(e) => onChange({ value: e.target.value })}
              className="h-7 w-32 text-xs"
              placeholder="valor"
            />
          )}
          {opNeedsTwoValues && (
            <>
              <span className="text-[11px] text-muted-foreground">e</span>
              <Input
                type={inputType}
                value={filter.value2 ?? ''}
                onChange={(e) => onChange({ value2: e.target.value })}
                className="h-7 w-32 text-xs"
                placeholder="valor"
              />
            </>
          )}
        </>
      )}

      {/* Remover */}
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        aria-label="Remover filtro"
        title="Remover filtro"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
