/**
 * Menu "..." de ações de coluna (Sprint 3.9).
 * Renderizado via portal para escapar do overflow-x-auto da tabela.
 * Contém: sort, filtro por tipo, ocultar, renomear/excluir (custom cols).
 */
import {
  ArrowDown, ArrowUp, EyeOff, MoreHorizontal, Pencil, Trash2, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { ProjectTaskColumn } from '@/features/projects2/task-columns-types'
import { getFilterKind, initials, isFilterActive } from './helpers'
import type { ColFilter, Column, TableSort, UserMini } from './types'

export interface ColumnActionsMenuProps {
  col: Column
  customCol?: ProjectTaskColumn
  sort: TableSort | null
  onSort: (dir: 'asc' | 'desc') => void
  onClearSort: () => void
  colFilter: ColFilter | undefined
  onFilter: (f: ColFilter | null) => void
  canHide: boolean
  onHide: () => void
  canEdit: boolean
  onRename?: (colId: string, newLabel: string) => void
  onDelete?: (colId: string) => void
  users: UserMini[]
  milestoneStatusOptions: { value: string; label: string }[]
  customColOptions?: { value: string; label: string }[]
}

export function ColumnActionsMenu({
  col, customCol, sort, onSort, onClearSort,
  colFilter, onFilter, canHide, onHide, canEdit,
  onRename, onDelete, users, milestoneStatusOptions, customColOptions,
}: ColumnActionsMenuProps) {
  const [open, setOpen]           = useState(false)
  const [renaming, setRenaming]   = useState(false)
  const [renameDraft, setRenameDraft] = useState(customCol?.label ?? '')
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const isActive = colFilter ? isFilterActive(colFilter) : false
  const isSorted = sort?.key === col.key

  // Posição do menu (fixed portal)
  useEffect(() => {
    if (!open || !btnRef.current) return
    const update = () => {
      const rect = btnRef.current!.getBoundingClientRect()
      const approxH = 380
      const spaceBelow = window.innerHeight - rect.bottom
      const top  = spaceBelow < approxH ? Math.max(4, rect.top - approxH) : rect.bottom + 2
      const left = Math.min(rect.left, window.innerWidth - 264)
      setMenuPos({ top, left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  // Click fora fecha
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false); setRenaming(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const filterKind = getFilterKind(col.key, customCol)

  // Estado local do filtro — sincroniza ao abrir
  const [lf, setLf] = useState<ColFilter | null>(colFilter ?? null)
  useEffect(() => { setLf(colFilter ?? null) }, [colFilter, open])

  function applyFilter(f: ColFilter | null) {
    setLf(f)
    onFilter(f && isFilterActive(f) ? f : null)
  }

  const selectOpts = col.key === 'status'
    ? milestoneStatusOptions
    : (customColOptions ?? customCol?.options?.values?.map(o => ({ value: o.value, label: o.label })) ?? [])

  return (
    <div className="relative ml-auto shrink-0" onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(o => !o); setRenameDraft(customCol?.label ?? '') }}
        className={`relative p-0.5 rounded transition-colors hover:bg-muted/70 ${isActive || isSorted ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        title="Opções da coluna"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        {isActive && (
          <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-primary pointer-events-none" />
        )}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden"
        >
          {/* ── Sort ── */}
          <div className="py-1 border-b border-border">
            <button type="button"
              onClick={() => { onSort('asc'); setOpen(false) }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted/50 ${isSorted && sort?.dir === 'asc' ? 'text-primary font-semibold' : ''}`}>
              <ArrowUp className="h-3.5 w-3.5 shrink-0" /> Ordenar A → Z
            </button>
            <button type="button"
              onClick={() => { onSort('desc'); setOpen(false) }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted/50 ${isSorted && sort?.dir === 'desc' ? 'text-primary font-semibold' : ''}`}>
              <ArrowDown className="h-3.5 w-3.5 shrink-0" /> Ordenar Z → A
            </button>
            {isSorted && (
              <button type="button"
                onClick={() => { onClearSort(); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50">
                <X className="h-3.5 w-3.5 shrink-0" /> Remover ordenação
              </button>
            )}
          </div>

          {/* ── Filtro ── */}
          {filterKind && (
            <div className="px-3 py-2 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Filtrar</span>
                {isActive && (
                  <button type="button" onClick={() => applyFilter(null)}
                    className="text-[10px] text-primary hover:underline">Limpar</button>
                )}
              </div>

              {filterKind === 'text' && (
                <input
                  value={lf?.kind === 'text' ? lf.contains : ''}
                  onChange={e => applyFilter({ kind: 'text', contains: e.target.value })}
                  placeholder="Contém..."
                  className="w-full h-7 px-2 text-xs rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                />
              )}

              {filterKind === 'date' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-6 shrink-0">De</span>
                    <input type="date"
                      value={lf?.kind === 'date' ? lf.from : ''}
                      onChange={e => applyFilter({ kind: 'date', from: e.target.value, to: lf?.kind === 'date' ? lf.to : '' })}
                      className="flex-1 h-7 px-1.5 text-xs rounded border bg-background outline-none" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-6 shrink-0">Até</span>
                    <input type="date"
                      value={lf?.kind === 'date' ? lf.to : ''}
                      onChange={e => applyFilter({ kind: 'date', from: lf?.kind === 'date' ? lf.from : '', to: e.target.value })}
                      className="flex-1 h-7 px-1.5 text-xs rounded border bg-background outline-none" />
                  </div>
                </>
              )}

              {filterKind === 'number' && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={lf?.kind === 'number' ? lf.op : 'eq'}
                    onChange={e => applyFilter({ kind: 'number', op: e.target.value as any, val: lf?.kind === 'number' ? lf.val : '' })}
                    className="h-7 px-1 text-xs rounded border bg-background outline-none"
                  >
                    <option value="eq">=</option>
                    <option value="gt">&gt;</option>
                    <option value="gte">≥</option>
                    <option value="lt">&lt;</option>
                    <option value="lte">≤</option>
                  </select>
                  <input type="number"
                    value={lf?.kind === 'number' ? lf.val : ''}
                    onChange={e => applyFilter({ kind: 'number', op: lf?.kind === 'number' ? lf.op : 'eq', val: e.target.value })}
                    placeholder="Valor..."
                    className="flex-1 h-7 px-2 text-xs rounded border bg-background outline-none"
                  />
                </div>
              )}

              {filterKind === 'select' && (
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {selectOpts.map(opt => {
                    const checked = lf?.kind === 'select' && lf.values.includes(opt.value)
                    return (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            const curr = lf?.kind === 'select' ? lf.values : []
                            const next = checked ? curr.filter(v => v !== opt.value) : [...curr, opt.value]
                            applyFilter(next.length === 0 ? null : { kind: 'select', values: next })
                          }}
                          className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{opt.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {filterKind === 'people' && (
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {users.map(u => {
                    const checked = lf?.kind === 'people' && lf.ids.includes(u.id)
                    return (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            const curr = lf?.kind === 'people' ? lf.ids : []
                            const next = checked ? curr.filter(id => id !== u.id) : [...curr, u.id]
                            applyFilter(next.length === 0 ? null : { kind: 'people', ids: next })
                          }}
                          className="h-3.5 w-3.5 shrink-0" />
                        <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-semibold shrink-0">
                          {initials(u.name)}
                        </div>
                        <span className="text-xs truncate">{u.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {filterKind === 'bool' && (
                <div className="flex gap-1.5">
                  {([
                    { label: 'Qualquer', v: null },
                    { label: 'Marcado',  v: true  },
                    { label: 'Desm.',    v: false  },
                  ] as const).map(item => (
                    <button key={String(item.v)} type="button"
                      onClick={() => applyFilter(item.v === null ? null : { kind: 'bool', checked: item.v })}
                      className={`flex-1 text-[11px] py-1 rounded border transition-colors ${
                        (lf?.kind === 'bool' ? lf.checked : null) === item.v
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border hover:bg-muted/50'
                      }`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Ações ── */}
          <div className="py-1">
            {canHide && (
              <button type="button"
                onClick={() => { onHide(); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50">
                <EyeOff className="h-3.5 w-3.5 shrink-0" /> Ocultar coluna
              </button>
            )}

            {customCol && canEdit && onRename && (
              renaming ? (
                <div className="px-2 py-1.5 space-y-1">
                  <input
                    autoFocus value={renameDraft} onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  { onRename(customCol.id, renameDraft); setOpen(false); setRenaming(false) }
                      if (e.key === 'Escape') setRenaming(false)
                    }}
                    className="w-full text-xs px-2 py-1 rounded border bg-background outline-none"
                  />
                  <div className="flex gap-1">
                    <button type="button"
                      onClick={() => { onRename(customCol.id, renameDraft); setOpen(false); setRenaming(false) }}
                      className="flex-1 text-xs py-0.5 rounded bg-primary text-primary-foreground">OK</button>
                    <button type="button" onClick={() => setRenaming(false)}
                      className="flex-1 text-xs py-0.5 rounded border border-border">×</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setRenaming(true)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted/50">
                  <Pencil className="h-3.5 w-3.5 shrink-0" /> Renomear
                </button>
              )
            )}

            {customCol && canEdit && onDelete && !renaming && (
              <button type="button"
                onClick={() => { onDelete(customCol.id); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                <Trash2 className="h-3.5 w-3.5 shrink-0" /> Excluir coluna
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
