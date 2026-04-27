/**
 * DataTable — sort + filtro multi-select por coluna no estilo Excel/Airtable.
 *
 * Cada coluna ganha um header com:
 *   1. Click no rótulo: cycle de sort (none → asc → desc → none)
 *   2. Ícone de funil: abre dropdown com lista de valores únicos da coluna
 *      como checkboxes; valor não-marcado é filtrado.
 *
 * Estado fica num hook `useDataTable` — quem usa monta a UI da tabela com
 * `<TableHead>` regular + `<DataTableHeaderCell>` no header. Mantém
 * compatibilidade total com o resto do componente Table do shadcn (não
 * precisa trocar TableBody/TableRow).
 *
 * Exemplo:
 *   const { rows, columnState } = useDataTable(allProjects, columns)
 *   // ... usa `rows` em <TableBody>, `columnState` em <DataTableHeaderCell>
 */
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

import { Button } from './button'
import { Input } from './input'
import {
  Pagination,
  usePagination,
  type PaginationState,
  DEFAULT_PAGE_SIZE,
} from './pagination'
import { TableHead } from './table'

export type SortDirection = 'asc' | 'desc' | null

/**
 * Definição de uma coluna na tabela. `getValue` é a função que extrai
 * o valor pra sort/filtro (default: row[key]). `formatValue` opcional
 * pra exibição no filtro dropdown (ex: status com label legível).
 */
export type DataTableColumn<T> = {
  /** Identificador único da coluna (geralmente o nome da prop). */
  key: string
  /** Label exibido no header. */
  label: string
  /** Sortable? Default true. */
  sortable?: boolean
  /** Filterable? Default true. */
  filterable?: boolean
  /**
   * Extrai o valor da row pra sort/filtro. Default: row[key].
   * Use quando o valor não é direto da prop (ex: data formatada, ref a
   * outro objeto, etc).
   */
  getValue?: (row: T) => string | number | boolean | null | undefined
  /**
   * Formata o valor pra exibição no dropdown do filtro. Default: String(value).
   * Útil pra exibir "Em negociação" em vez do id "negotiation".
   */
  formatValue?: (value: string | number | boolean | null | undefined) => string
}

type ColumnState = {
  sortBy: string | null
  sortDir: SortDirection
  /** Map de columnKey → Set de valores marcados (string-coerced). */
  filters: Record<string, Set<string>>
}

export type DataTableState<T> = {
  /**
   * Linhas APÓS filtro+sort (sem paginação). Use isto pra exportar CSV
   * ou contar todos os itens visíveis.
   */
  rows: T[]
  /** Linhas paginadas (use no `<TableBody>`). */
  paginatedRows: T[]
  /** Total antes de filtros (útil pra mostrar "X de Y"). */
  totalRows: number
  columnState: ColumnState
  setSort: (columnKey: string) => void
  toggleFilterValue: (columnKey: string, value: string) => void
  setFilterValues: (columnKey: string, values: Set<string>) => void
  clearFilter: (columnKey: string) => void
  clearAll: () => void
  /** Se algum filtro está ativo. Útil pra mostrar botão "limpar tudo". */
  hasActiveFilters: boolean
  /** Valores únicos disponíveis pra cada coluna (com formatação aplicada). */
  uniqueValues: Record<string, { raw: string; label: string }[]>
  /** Estado de paginação (passar pro `<DataTablePagination state={dt} />`). */
  pagination: PaginationState<T>
}

function rawValue<T>(row: T, col: DataTableColumn<T>): unknown {
  if (col.getValue) return col.getValue(row)
  return (row as Record<string, unknown>)[col.key]
}

function toCompareKey(v: unknown): string | number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v == null || v === '') return ''
  return String(v).toLocaleLowerCase()
}

export function useDataTable<T>(
  data: T[],
  columns: DataTableColumn<T>[],
  options?: { defaultPageSize?: number },
): DataTableState<T> {
  const [columnState, setColumnState] = useState<ColumnState>({
    sortBy: null,
    sortDir: null,
    filters: {},
  })

  const setSort = useCallback((columnKey: string) => {
    setColumnState((prev) => {
      // Cycle: none → asc → desc → none
      if (prev.sortBy !== columnKey) {
        return { ...prev, sortBy: columnKey, sortDir: 'asc' }
      }
      if (prev.sortDir === 'asc') return { ...prev, sortDir: 'desc' }
      if (prev.sortDir === 'desc') {
        return { ...prev, sortBy: null, sortDir: null }
      }
      return { ...prev, sortBy: columnKey, sortDir: 'asc' }
    })
  }, [])

  const setFilterValues = useCallback(
    (columnKey: string, values: Set<string>) => {
      setColumnState((prev) => ({
        ...prev,
        filters: { ...prev.filters, [columnKey]: values },
      }))
    },
    [],
  )

  const toggleFilterValue = useCallback(
    (columnKey: string, value: string) => {
      setColumnState((prev) => {
        const current = prev.filters[columnKey] ?? new Set<string>()
        const next = new Set(current)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return { ...prev, filters: { ...prev.filters, [columnKey]: next } }
      })
    },
    [],
  )

  const clearFilter = useCallback((columnKey: string) => {
    setColumnState((prev) => {
      const { [columnKey]: _drop, ...rest } = prev.filters
      return { ...prev, filters: rest }
    })
  }, [])

  const clearAll = useCallback(() => {
    setColumnState((prev) => ({ ...prev, filters: {} }))
  }, [])

  // Valores únicos por coluna pra popular o dropdown do filtro.
  const uniqueValues = useMemo(() => {
    const out: Record<string, { raw: string; label: string }[]> = {}
    for (const col of columns) {
      if (col.filterable === false) continue
      const seen = new Map<string, string>()
      for (const row of data) {
        const v = rawValue(row, col)
        const raw = v == null || v === '' ? '' : String(v)
        const label = col.formatValue
          ? col.formatValue(v as string | number | boolean | null | undefined)
          : raw === ''
            ? '—'
            : raw
        if (!seen.has(raw)) seen.set(raw, label)
      }
      out[col.key] = [...seen.entries()]
        .map(([raw, label]) => ({ raw, label }))
        .sort((a, b) => a.label.localeCompare(b.label))
    }
    return out
  }, [data, columns])

  // Aplica filtro + sort.
  const rows = useMemo(() => {
    let r = data

    // Filtros: cada coluna com Set não-vazio reduz r
    for (const col of columns) {
      if (col.filterable === false) continue
      const selected = columnState.filters[col.key]
      if (!selected || selected.size === 0) continue
      r = r.filter((row) => {
        const v = rawValue(row, col)
        const raw = v == null || v === '' ? '' : String(v)
        return selected.has(raw)
      })
    }

    // Sort
    if (columnState.sortBy && columnState.sortDir) {
      const col = columns.find((c) => c.key === columnState.sortBy)
      if (col && col.sortable !== false) {
        const dir = columnState.sortDir === 'asc' ? 1 : -1
        r = [...r].sort((a, b) => {
          const ka = toCompareKey(rawValue(a, col))
          const kb = toCompareKey(rawValue(b, col))
          if (ka < kb) return -1 * dir
          if (ka > kb) return 1 * dir
          return 0
        })
      }
    }

    return r
  }, [data, columns, columnState])

  const hasActiveFilters = useMemo(
    () =>
      Object.values(columnState.filters).some((set) => set && set.size > 0),
    [columnState.filters],
  )

  // Paginação fica POR CIMA das linhas filtradas+ordenadas. Quando
  // filtros mudam e a contagem encolhe, o hook clampa a página atual.
  const pagination = usePagination<T>(rows, options?.defaultPageSize ?? DEFAULT_PAGE_SIZE)

  return {
    rows,
    paginatedRows: pagination.paginated,
    totalRows: data.length,
    columnState,
    setSort,
    toggleFilterValue,
    setFilterValues,
    clearFilter,
    clearAll,
    hasActiveFilters,
    uniqueValues,
    pagination,
  }
}

/**
 * Footer pré-pronto pra usar com qualquer DataTable.
 * `<DataTablePagination state={dt} />` — esconde-se se cabe tudo numa página.
 */
export function DataTablePagination<T>({
  state,
  className,
}: {
  state: DataTableState<T>
  className?: string
}) {
  return <Pagination state={state.pagination} className={className} />
}

/**
 * Header da coluna com botões de sort + filtro. Click no rótulo cicla
 * o sort. O ícone de funil abre um dropdown com checkboxes dos valores
 * únicos. Quando algum filtro está ativo na coluna, o ícone fica colorido
 * (primary) pra dar dica visual.
 */
type DataTableHeaderCellProps<T> = {
  column: DataTableColumn<T>
  state: DataTableState<T>
  /** Largura/className do <th> wrapper. */
  className?: string
  align?: 'left' | 'right' | 'center'
}

export function DataTableHeaderCell<T>({
  column,
  state,
  className,
  align = 'left',
}: DataTableHeaderCellProps<T>) {
  const { t } = useTranslation()
  const sortable = column.sortable !== false
  const filterable = column.filterable !== false
  const isActiveSort = state.columnState.sortBy === column.key
  const sortDir = isActiveSort ? state.columnState.sortDir : null
  const filtered = state.columnState.filters[column.key]
  const isFiltered = !!(filtered && filtered.size > 0)

  return (
    <TableHead
      className={cn(
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      <div
        className={cn(
          'inline-flex items-center gap-1',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => state.setSort(column.key)}
            className="inline-flex items-center gap-1 hover:text-foreground"
            title={t('dataTable.clickToSort')}
          >
            <span>{column.label}</span>
            {sortDir === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : sortDir === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-30" />
            )}
          </button>
        ) : (
          <span>{column.label}</span>
        )}
        {filterable && (
          <FilterDropdown column={column} state={state} active={isFiltered} />
        )}
      </div>
    </TableHead>
  )
}

/**
 * Dropdown de filtro multi-select. Mostra busca interna (útil quando há
 * muitos valores) + checkboxes. Clique no botão "Limpar" remove o filtro
 * dessa coluna; "Selecionar todos" marca tudo.
 */
function FilterDropdown<T>({
  column,
  state,
  active,
}: {
  column: DataTableColumn<T>
  state: DataTableState<T>
  active: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const allValues = state.uniqueValues[column.key] ?? []
  const selected =
    state.columnState.filters[column.key] ?? new Set<string>()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allValues
    return allValues.filter((v) => v.label.toLowerCase().includes(q))
  }, [allValues, search])

  // Click fora fecha.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function toggleAll() {
    if (selected.size === allValues.length) {
      state.clearFilter(column.key)
    } else {
      state.setFilterValues(column.key, new Set(allValues.map((v) => v.raw)))
    }
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-accent',
          active ? 'text-primary' : 'text-muted-foreground/60',
        )}
        title={t('dataTable.filter')}
        aria-label={t('dataTable.filter')}
      >
        <Filter className="h-3 w-3" />
        {active && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="border-b border-border p-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('dataTable.searchValues')}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {t('dataTable.noValues')}
              </p>
            ) : (
              filtered.map((v) => {
                const checked = selected.has(v.raw)
                return (
                  <label
                    key={v.raw}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => state.toggleFilterValue(column.key, v.raw)}
                    />
                    <span className="truncate">{v.label}</span>
                  </label>
                )
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border p-2 text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={toggleAll}
            >
              {selected.size === allValues.length
                ? t('dataTable.clearAll')
                : t('dataTable.selectAll')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => state.clearFilter(column.key)}
              disabled={!active}
            >
              {t('dataTable.clearFilter')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Helper opcional pra renderizar uma "barra de filtros ativos" no topo
 * da tabela mostrando quais filtros estão aplicados, com botão pra limpar.
 */
export const DataTableActiveFilters = forwardRef<
  HTMLDivElement,
  {
    state: DataTableState<unknown>
    columns: DataTableColumn<unknown>[]
    className?: string
  }
>(function DataTableActiveFilters({ state, columns, className }, ref) {
  const { t } = useTranslation()
  if (!state.hasActiveFilters) return null
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs',
        className,
      )}
    >
      <span className="text-muted-foreground">
        {t('dataTable.activeFilters')}:
      </span>
      {Object.entries(state.columnState.filters).map(([key, set]) => {
        if (!set || set.size === 0) return null
        const col = columns.find((c) => c.key === key)
        if (!col) return null
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-medium text-foreground"
          >
            {col.label}: {set.size}
            <button
              type="button"
              onClick={() => state.clearFilter(key)}
              className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={t('dataTable.clearFilter')}
            >
              ×
            </button>
          </span>
        )
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => state.clearAll()}
      >
        {t('dataTable.clearAll')}
      </Button>
      <span className="ml-auto tabular-nums text-muted-foreground">
        {state.rows.length} / {state.totalRows}
      </span>
    </div>
  )
})
