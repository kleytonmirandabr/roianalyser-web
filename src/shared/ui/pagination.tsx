/**
 * Paginação universal — hook + componente de UI.
 *
 * Filosofia: hook reutilizável (`usePagination`) que pode ser plugado
 * tanto no `useDataTable` quanto em telas com `<Table>` cru. O componente
 * `<Pagination>` mostra o footer padronizado: dropdown de tamanho de
 * página + navegação numerada + contador "mostrando X-Y de N".
 *
 * Quando uma lista tem ≤ pageSize itens, o componente esconde a si mesmo
 * (não tem porque mostrar "1 de 1" se cabe tudo na primeira página).
 */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { Button } from './button'

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25

export type PaginationState<T> = {
  /** Itens recortados pra página atual. */
  paginated: T[]
  /** Total de itens (pré-paginação, pós-filtro). */
  total: number
  /** Página atual (1-based). */
  page: number
  pageSize: number
  totalPages: number
  /** Índice 1-based do primeiro item da página atual. */
  fromIndex: number
  /** Índice 1-based do último item da página atual. */
  toIndex: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  nextPage: () => void
  prevPage: () => void
  firstPage: () => void
  lastPage: () => void
  /** Reseta pra página 1 — útil quando filtros mudam. */
  reset: () => void
}

/**
 * Hook que recebe o array já filtrado/ordenado e devolve a fatia da
 * página atual. Page reseta automaticamente quando a lista encolhe
 * abaixo do range atual (filtro mais restritivo, etc).
 */
export function usePagination<T>(
  items: T[],
  defaultPageSize: number = DEFAULT_PAGE_SIZE,
): PaginationState<T> {
  const [page, setPageRaw] = useState(1)
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize)

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Auto-clamp: se a página atual ficou fora do range (filtro reduziu),
  // volta pra última página válida.
  useEffect(() => {
    if (page > totalPages) setPageRaw(totalPages)
  }, [page, totalPages])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const setPage = useCallback(
    (p: number) => setPageRaw(Math.max(1, Math.min(p, totalPages))),
    [totalPages],
  )
  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size)
    setPageRaw(1)
  }, [])
  const nextPage = useCallback(
    () => setPageRaw((p) => Math.min(p + 1, totalPages)),
    [totalPages],
  )
  const prevPage = useCallback(() => setPageRaw((p) => Math.max(p - 1, 1)), [])
  const firstPage = useCallback(() => setPageRaw(1), [])
  const lastPage = useCallback(() => setPageRaw(totalPages), [totalPages])
  const reset = useCallback(() => setPageRaw(1), [])

  const fromIndex = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toIndex = Math.min(page * pageSize, total)

  return {
    paginated,
    total,
    page,
    pageSize,
    totalPages,
    fromIndex,
    toIndex,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    reset,
  }
}

/**
 * Footer visual padrão. Esconde-se quando total ≤ menor pageSize do
 * dropdown (não vale a pena mostrar paginação se cabe tudo na página).
 */
export function Pagination<T>({
  state,
  className,
  hideWhenSinglePage = true,
  pageSizeOptions = PAGE_SIZE_OPTIONS as readonly number[],
}: {
  state: PaginationState<T>
  className?: string
  hideWhenSinglePage?: boolean
  pageSizeOptions?: readonly number[]
}) {
  const { t } = useTranslation()
  if (hideWhenSinglePage && state.total <= pageSizeOptions[0]) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 py-2 text-xs text-muted-foreground',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span>
          {t('pagination.showing', {
            defaultValue: 'Mostrando {{from}}–{{to}} de {{total}}',
            from: state.fromIndex,
            to: state.toIndex,
            total: state.total,
          })}
        </span>
        <span className="opacity-60">·</span>
        <label className="flex items-center gap-1">
          <span>{t('pagination.pageSize', { defaultValue: 'Por página:' })}</span>
          <select
            value={state.pageSize}
            onChange={(e) => state.setPageSize(Number(e.target.value))}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={state.firstPage}
          disabled={state.page === 1}
          aria-label={t('pagination.first', { defaultValue: 'Primeira' })}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={state.prevPage}
          disabled={state.page === 1}
          aria-label={t('pagination.prev', { defaultValue: 'Anterior' })}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 tabular-nums">
          {t('pagination.pageOf', {
            defaultValue: '{{page}} de {{total}}',
            page: state.page,
            total: state.totalPages,
          })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={state.nextPage}
          disabled={state.page === state.totalPages}
          aria-label={t('pagination.next', { defaultValue: 'Próxima' })}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={state.lastPage}
          disabled={state.page === state.totalPages}
          aria-label={t('pagination.last', { defaultValue: 'Última' })}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
