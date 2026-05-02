/**
 * Tabela tipo Excel (Phase 3 Sprint 3.6 → 3.9) para o Cronograma do projeto.
 *
 * Sprint 3.9 — novas features:
 *   - Menu "..." em TODAS as colunas de dados: sort, filtro por tipo, ocultar
 *   - Filtros inline por tipo: text (contém), select/status (checkboxes),
 *     date (de/até), number (op+valor), people (usuários por checkbox)
 *   - Indicador de filtro ativo no header (ícone Filter)
 *   - Barra "Limpar filtros" + "Restaurar colunas ocultas"
 */
import {
  DndContext, DragOverlay, PointerSensor,
  closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronDown, ChevronRight,
  Circle, Eye, EyeOff, Filter, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, UserCircle2, X,
} from 'lucide-react'
import {
  useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import {
  MILESTONE_STATUS_COLORS, MILESTONE_STATUS_LABELS,
  type MilestoneKind, type MilestoneStatus, type ProjectMilestone,
} from '@/features/projects2/milestones-types'
import type { ProjectTaskColumn, TaskColumnValue } from '@/features/projects2/task-columns-types'
import { Combobox } from '@/shared/ui/combobox'
import { ColumnCellEditor, ColumnCellReadonly } from '@/features/projects2/components/ColumnCellEditor'

// ─── ColFilter ────────────────────────────────────────────────────────────────
export type ColFilter =
  | { kind: 'text';   contains: string }
  | { kind: 'select'; values: string[] }
  | { kind: 'date';   from: string; to: string }
  | { kind: 'number'; op: 'eq' | 'lt' | 'gt' | 'lte' | 'gte'; val: string }
  | { kind: 'people'; ids: string[] }
  | { kind: 'bool';   checked: boolean | null }

type FilterKind = 'text' | 'select' | 'date' | 'number' | 'people' | 'bool'

function isFilterActive(f: ColFilter): boolean {
  switch (f.kind) {
    case 'text':   return f.contains.trim() !== ''
    case 'select': return f.values.length > 0
    case 'date':   return f.from !== '' || f.to !== ''
    case 'number': return f.val.trim() !== ''
    case 'people': return f.ids.length > 0
    case 'bool':   return f.checked !== null
  }
}

function matchColFilter(value: any, f: ColFilter): boolean {
  switch (f.kind) {
    case 'text':
      return String(value ?? '').toLowerCase().includes(f.contains.toLowerCase())
    case 'select':
      return f.values.includes(String(value ?? ''))
    case 'date': {
      let d: string
      if (value && typeof value === 'object' && 'start' in value) {
        d = ((value as { start?: string }).start ?? '').slice(0, 10)
      } else {
        d = String(value ?? '').slice(0, 10)
      }
      if (!d) return false
      if (f.from && d < f.from) return false
      if (f.to && d > f.to) return false
      return true
    }
    case 'number': {
      const n = Number(value ?? 0)
      const v = Number(f.val)
      if (isNaN(v)) return true
      switch (f.op) {
        case 'eq':  return n === v
        case 'lt':  return n < v
        case 'gt':  return n > v
        case 'lte': return n <= v
        case 'gte': return n >= v
        default:    return true
      }
    }
    case 'people': {
      const ids = Array.isArray(value) ? value : []
      return f.ids.some(id => ids.includes(id))
    }
    case 'bool':
      if (f.checked === null) return true
      return !!value === f.checked
  }
}

function getFilterKind(colKey: string, customCol?: ProjectTaskColumn): FilterKind | null {
  if (colKey === 'title')     return 'text'
  if (colKey === 'plannedDate' || colKey === 'updatedAt') return 'date'
  if (colKey === 'status')    return 'select'
  if (colKey === 'responsible') return 'people'
  if (colKey === 'progress')  return 'number'
  if (!customCol) return null
  switch (customCol.type) {
    case 'text': case 'long_text': case 'link': return 'text'
    case 'number': case 'currency': case 'percent': case 'progress': case 'rating': return 'number'
    case 'date': case 'date_range': return 'date'
    case 'select': case 'status': return 'select'
    case 'checkbox': return 'bool'
    default: return null
  }
}

// ─── Palette + UI helpers ─────────────────────────────────────────────────────
const PILL_PALETTE = [
  'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400',
  'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-300',
]

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }
  catch { return iso }
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const sec = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
    if (sec < 60) return `${sec}s`
    const min = Math.round(sec / 60); if (min < 60) return `${min}m`
    const hr = Math.round(min / 60);  if (hr < 24)  return `${hr}h`
    const day = Math.round(hr / 24);  if (day < 7)  return `${day}d`
    if (day < 30)  return `${Math.round(day / 7)}sem`
    if (day < 365) return `${Math.round(day / 30)}mes`
    return `${Math.round(day / 365)}ano`
  } catch { return '' }
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Component types ──────────────────────────────────────────────────────────
interface UserMini { id: string; name: string; email: string }

export interface TableSort { key: string; dir: 'asc' | 'desc' }

interface Props {
  items: ProjectMilestone[]
  customCols: ProjectTaskColumn[]
  valuesByTaskCol: Record<string, Record<string, TaskColumnValue>>
  users: UserMini[]
  canEdit: boolean
  collapsed: Set<string>
  onToggleCollapse: (id: string) => void
  onUpdateTask: (id: string, patch: any) => void
  onDeleteTask: (m: ProjectMilestone) => void
  onCreateTask: (kind: MilestoneKind, parentId: string | null, title: string) => Promise<void>
  onReorderGroup: (groupId: string | null, orderedIds: string[]) => void
  onPutColumnValue: (taskId: string, colId: string, value: any) => void
  onOpenColumnsManager: () => void
  onRenameColumn?: (colId: string, newLabel: string) => void
  onDeleteColumn?: (colId: string) => void
  subtaskCount: Record<string, number>
  createRequest?: { kind: MilestoneKind } | null
  onCreateRequestConsumed?: () => void
}

interface Column {
  key: string; label: string; width: string
  sortable?: boolean; align?: 'left' | 'right' | 'center'; colId?: string
}

interface InlineCreate {
  kind: MilestoneKind
  parentId: string | null
  groupId: string | null
}

interface FlatRow   { _type: 'task';   task: ProjectMilestone; level: 0|1|2; groupId?: string }
interface AddRow    { _type: 'add';    groupId: string | null }
interface FooterRow { _type: 'footer'; groupId: string; total: number; done: number; avgPct: number }
interface AddGroup  { _type: 'add-group' }
type Row = FlatRow | AddRow | FooterRow | AddGroup

// Columns that can never be hidden (structural)
const NON_HIDEABLE = new Set(['drag', 'expand', 'check', 'title', 'addCol', 'rowActions'])

// ─── MultiPeoplePicker ────────────────────────────────────────────────────────
function MultiPeoplePicker({ value, users, onChange, disabled }:
  { value: string[]; users: UserMini[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])
  const filtered = users.filter(u => !search.trim() || u.name.toLowerCase().includes(search.toLowerCase()))
  const selected = users.filter(u => value.includes(u.id))
  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="w-full flex items-center gap-1 min-h-[28px] px-1 rounded hover:bg-muted/40 transition-colors disabled:cursor-not-allowed"
      >
        {selected.length === 0 ? (
          <UserCircle2 className="h-5 w-5 text-muted-foreground/40" />
        ) : selected.slice(0, 3).map(u => (
          <div key={u.id} className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0" title={u.name}>
            {initials(u.name)}
          </div>
        ))}
        {selected.length > 3 && <span className="text-[10px] text-muted-foreground">+{selected.length - 3}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 max-h-56 rounded-md border bg-popover shadow-lg overflow-auto">
          <div className="p-1.5 border-b">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full text-xs px-2 py-1 rounded border bg-background outline-none"
            />
          </div>
          <ul className="py-1">
            {filtered.map(u => {
              const sel = value.includes(u.id)
              return (
                <li key={u.id}
                  className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer ${sel ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                  onClick={() => onChange(sel ? value.filter(id => id !== u.id) : [...value, u.id])}
                >
                  <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-semibold shrink-0">
                    {initials(u.name)}
                  </div>
                  <span className="truncate">{u.name}</span>
                  {sel && <span className="ml-auto text-primary text-[10px]">✓</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── SelectPill (readonly custom cols) ───────────────────────────────────────
function SelectPill({ column, value }: { column: ProjectTaskColumn; value: any }) {
  if (!value) return null
  const opts = column.options?.values || []
  const opt = opts.find(o => o.value === value)
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

// ─── ColumnActionsMenu ────────────────────────────────────────────────────────
interface ColActionsProps {
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

function ColumnActionsMenu({
  col, customCol, sort, onSort, onClearSort,
  colFilter, onFilter, canHide, onHide, canEdit,
  onRename, onDelete, users, milestoneStatusOptions, customColOptions,
}: ColActionsProps) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState(customCol?.label ?? '')
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const isActive = colFilter ? isFilterActive(colFilter) : false
  const isSorted = sort?.key === col.key

  // Position calculation
  useEffect(() => {
    if (!open || !btnRef.current) return
    const update = () => {
      const rect = btnRef.current!.getBoundingClientRect()
      const approxHeight = 380
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow < approxHeight ? Math.max(4, rect.top - approxHeight) : rect.bottom + 2
      setMenuPos({ top, left: Math.min(rect.left, window.innerWidth - 264) })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  // Click outside closes
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false)
        setRenaming(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const filterKind = getFilterKind(col.key, customCol)

  // Local filter state — synced from prop on open
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

          {/* ── Filter ── */}
          {filterKind && (
            <div className="px-3 py-2 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                  Filtrar
                </span>
                {isActive && (
                  <button type="button" onClick={() => applyFilter(null)}
                    className="text-[10px] text-primary hover:underline">
                    Limpar
                  </button>
                )}
              </div>

              {/* text */}
              {filterKind === 'text' && (
                <input
                  value={lf?.kind === 'text' ? lf.contains : ''}
                  onChange={e => applyFilter({ kind: 'text', contains: e.target.value })}
                  placeholder="Contém..."
                  className="w-full h-7 px-2 text-xs rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                />
              )}

              {/* date */}
              {filterKind === 'date' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-6 shrink-0">De</span>
                    <input type="date"
                      value={lf?.kind === 'date' ? lf.from : ''}
                      onChange={e => applyFilter({
                        kind: 'date',
                        from: e.target.value,
                        to: lf?.kind === 'date' ? lf.to : '',
                      })}
                      className="flex-1 h-7 px-1.5 text-xs rounded border bg-background outline-none" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-6 shrink-0">Até</span>
                    <input type="date"
                      value={lf?.kind === 'date' ? lf.to : ''}
                      onChange={e => applyFilter({
                        kind: 'date',
                        from: lf?.kind === 'date' ? lf.from : '',
                        to: e.target.value,
                      })}
                      className="flex-1 h-7 px-1.5 text-xs rounded border bg-background outline-none" />
                  </div>
                </>
              )}

              {/* number */}
              {filterKind === 'number' && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={lf?.kind === 'number' ? lf.op : 'eq'}
                    onChange={e => applyFilter({
                      kind: 'number',
                      op: e.target.value as ColFilter & { kind: 'number' } extends { op: infer O } ? O : never,
                      val: lf?.kind === 'number' ? lf.val : '',
                    })}
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
                    onChange={e => applyFilter({
                      kind: 'number',
                      op: lf?.kind === 'number' ? lf.op : 'eq',
                      val: e.target.value,
                    })}
                    placeholder="Valor..."
                    className="flex-1 h-7 px-2 text-xs rounded border bg-background outline-none"
                  />
                </div>
              )}

              {/* select */}
              {filterKind === 'select' && (
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {selectOpts.map(opt => {
                    const checked = lf?.kind === 'select' && lf.values.includes(opt.value)
                    return (
                      <label key={opt.value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                        <input type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const curr = lf?.kind === 'select' ? lf.values : []
                            const next = checked ? curr.filter(v => v !== opt.value) : [...curr, opt.value]
                            applyFilter(next.length === 0 ? null : { kind: 'select', values: next })
                          }}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        <span className="text-xs">{opt.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* people */}
              {filterKind === 'people' && (
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {users.map(u => {
                    const checked = lf?.kind === 'people' && lf.ids.includes(u.id)
                    return (
                      <label key={u.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                        <input type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const curr = lf?.kind === 'people' ? lf.ids : []
                            const next = checked ? curr.filter(id => id !== u.id) : [...curr, u.id]
                            applyFilter(next.length === 0 ? null : { kind: 'people', ids: next })
                          }}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-semibold shrink-0">
                          {initials(u.name)}
                        </div>
                        <span className="text-xs truncate">{u.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* bool (checkbox column) */}
              {filterKind === 'bool' && (
                <div className="flex gap-1.5">
                  {([
                    { label: 'Qualquer', v: null },
                    { label: 'Marcado', v: true },
                    { label: 'Desmarcado', v: false },
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

          {/* ── Column actions ── */}
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
                    autoFocus
                    value={renameDraft}
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { onRename(customCol.id, renameDraft); setOpen(false); setRenaming(false) }
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

// ─── SortableRow wrapper for DnD ─────────────────────────────────────────────
function SortableRow({ id, children, disabled }: { id: string; children: (drag: ReactNode) => ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : undefined,
  }
  const handle = !disabled ? (
    <div {...attributes} {...listeners}
      className="flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors"
      style={{ touchAction: 'none' }}>
      <GripVertical className="h-3.5 w-3.5" />
    </div>
  ) : <div />
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  )
}

// ─── Column widths + alignment maps ──────────────────────────────────────────
const COL_WIDTH: Record<string, string> = {
  text: '160px', long_text: '200px', number: '100px', currency: '130px',
  percent: '90px', progress: '90px', date: '130px', date_range: '260px',
  checkbox: '70px', rating: '110px', select: '150px', status: '150px', link: '180px',
}
const COL_ALIGN: Record<string, 'left' | 'right' | 'center'> = {
  number: 'center', currency: 'right', percent: 'center',
  progress: 'center', date: 'center', checkbox: 'center', rating: 'center',
  select: 'center', status: 'center',
}

// ─── TasksTableView ───────────────────────────────────────────────────────────
export function TasksTableView({
  items, customCols, valuesByTaskCol, users, canEdit,
  collapsed, onToggleCollapse, onUpdateTask, onDeleteTask,
  onCreateTask, onReorderGroup,
  onPutColumnValue, onOpenColumnsManager,
  onRenameColumn, onDeleteColumn,
  subtaskCount,
  createRequest, onCreateRequestConsumed,
}: Props) {
  const [sort, setSort]                       = useState<TableSort | null>(null)
  const [editingTitleId, setEditingTitleId]   = useState<string | null>(null)
  const [titleDraft, setTitleDraft]           = useState('')
  const titleInputRef                         = useRef<HTMLInputElement>(null)

  // ── Inline create ──
  const [inlineCreate, setInlineCreate]   = useState<InlineCreate | null>(null)
  const [inlineTitle, setInlineTitle]     = useState('')
  const [inlineSaving, setInlineSaving]   = useState(false)
  const inlineInputRef                    = useRef<HTMLInputElement>(null)

  // ── DnD ──
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Sprint 3.9: filters + hidden cols ──
  const [colFilters, setColFilters]   = useState<Record<string, ColFilter>>({})
  const [hiddenCols, setHiddenCols]   = useState<Set<string>>(new Set())

  useEffect(() => { if (editingTitleId) titleInputRef.current?.focus() }, [editingTitleId])
  useEffect(() => { if (inlineCreate) setTimeout(() => inlineInputRef.current?.focus(), 30) }, [inlineCreate])

  useEffect(() => {
    if (createRequest) {
      setInlineCreate({ kind: createRequest.kind, parentId: null, groupId: null })
      setInlineTitle('')
      onCreateRequestConsumed?.()
    }
  }, [createRequest])

  function startEditTitle(t: ProjectMilestone) {
    if (!canEdit) return
    setEditingTitleId(t.id)
    setTitleDraft(t.title)
  }

  function commitTitle(taskId: string) {
    if (titleDraft.trim()) onUpdateTask(taskId, { title: titleDraft.trim() })
    setEditingTitleId(null)
  }

  function openInlineCreate(kind: MilestoneKind, parentId: string | null, groupId: string | null) {
    setInlineCreate({ kind, parentId, groupId })
    setInlineTitle('')
  }

  async function commitInlineCreate(andContinue = false) {
    if (!inlineTitle.trim() || !inlineCreate || inlineSaving) return
    setInlineSaving(true)
    try {
      await onCreateTask(inlineCreate.kind, inlineCreate.parentId, inlineTitle.trim())
      setInlineTitle('')
      if (!andContinue) setInlineCreate(null)
      else inlineInputRef.current?.focus()
    } finally {
      setInlineSaving(false)
    }
  }

  // ── Tree ──
  const tree = useMemo(() => {
    const rootGroups = items.filter(i => i.kind === 'group' && !i.parentId)
    const rootTasks  = items.filter(i => i.kind === 'task'  && !i.parentId)
    const tasksByParent: Record<string, ProjectMilestone[]> = {}
    const subtasksByParent: Record<string, ProjectMilestone[]> = {}
    items.forEach(i => {
      if (i.parentId && i.kind === 'task')         (tasksByParent[i.parentId]    = tasksByParent[i.parentId]    || []).push(i)
      else if (i.parentId && i.kind === 'subtask') (subtasksByParent[i.parentId] = subtasksByParent[i.parentId] || []).push(i)
    })
    return { rootGroups, rootTasks, tasksByParent, subtasksByParent }
  }, [items])

  function sortArr(arr: ProjectMilestone[]): ProjectMilestone[] {
    const out = arr.slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    if (!sort) return out
    out.sort((a, b) => {
      let av: any = '', bv: any = ''
      if (sort.key === 'title')         { av = a.title; bv = b.title }
      else if (sort.key === 'plannedDate')  { av = a.plannedDate || '\uffff'; bv = b.plannedDate || '\uffff' }
      else if (sort.key === 'status')   { av = a.status; bv = b.status }
      else if (sort.key === 'progress') { av = a.progressPct ?? 0; bv = b.progressPct ?? 0 }
      else if (sort.key === 'updatedAt') { av = a.updatedAt; bv = b.updatedAt }
      else if (sort.key.startsWith('col_')) {
        const colId = sort.key.slice(4)
        av = valuesByTaskCol[a.id]?.[colId]?.value ?? ''
        bv = valuesByTaskCol[b.id]?.[colId]?.value ?? ''
      }
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'pt-BR')
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return out
  }

  // ── Filter matching ──
  function taskMatchesFilters(t: ProjectMilestone): boolean {
    for (const [key, f] of Object.entries(colFilters)) {
      if (!isFilterActive(f)) continue
      let match = true
      if (key === 'title')        match = matchColFilter(t.title, f)
      else if (key === 'plannedDate') match = matchColFilter(t.plannedDate?.slice(0, 10), f)
      else if (key === 'status')  match = matchColFilter(t.status, f)
      else if (key === 'responsible') match = matchColFilter(t.responsibleIds, f)
      else if (key === 'progress') match = matchColFilter(t.progressPct, f)
      else if (key === 'updatedAt') match = matchColFilter(t.updatedAt?.slice(0, 10), f)
      else if (key.startsWith('col_')) {
        const colId = key.slice(4)
        match = matchColFilter(valuesByTaskCol[t.id]?.[colId]?.value ?? null, f)
      }
      if (!match) return false
    }
    return true
  }

  const hasActiveFilters = useMemo(
    () => Object.values(colFilters).some(f => isFilterActive(f)),
    [colFilters]
  )

  // ── Flat rows ──
  const flatRows: Row[] = useMemo(() => {
    const out: Row[] = []

    // Root tasks
    sortArr(tree.rootTasks).forEach(t => {
      if (hasActiveFilters && !taskMatchesFilters(t)) return
      out.push({ _type: 'task', task: t, level: 1 })
      if (!collapsed.has(t.id)) {
        sortArr(tree.subtasksByParent[t.id] || []).forEach(s => {
          if (hasActiveFilters && !taskMatchesFilters(s)) return
          out.push({ _type: 'task', task: s, level: 2 })
        })
      }
    })
    if (canEdit) out.push({ _type: 'add', groupId: null })

    // Groups
    sortArr(tree.rootGroups).forEach(g => {
      out.push({ _type: 'task', task: g, level: 0 })
      if (!collapsed.has(g.id)) {
        const groupTasks = sortArr(tree.tasksByParent[g.id] || [])
        const visibleGroupTasks = hasActiveFilters
          ? groupTasks.filter(t => taskMatchesFilters(t))
          : groupTasks
        visibleGroupTasks.forEach(t => {
          out.push({ _type: 'task', task: t, level: 1, groupId: g.id })
          if (!collapsed.has(t.id)) {
            sortArr(tree.subtasksByParent[t.id] || []).forEach(s => {
              if (hasActiveFilters && !taskMatchesFilters(s)) return
              out.push({ _type: 'task', task: s, level: 2, groupId: g.id })
            })
          }
        })
        if (visibleGroupTasks.length > 0) {
          const done = visibleGroupTasks.filter(t => t.status === 'done').length
          const avgPct = Math.round(visibleGroupTasks.reduce((acc, t) => acc + (t.progressPct || 0), 0) / visibleGroupTasks.length)
          out.push({ _type: 'footer', groupId: g.id, total: visibleGroupTasks.length, done, avgPct })
        }
        if (canEdit) out.push({ _type: 'add', groupId: g.id })
      }
    })

    if (canEdit) out.push({ _type: 'add-group' })
    return out
  }, [tree, collapsed, sort, canEdit, colFilters, valuesByTaskCol])

  // IDs por grupo (para DnD)
  const idsByGroup = useMemo(() => {
    const map: Record<string, string[]> = { __root__: [] }
    tree.rootTasks.forEach(t => map['__root__'].push(t.id))
    tree.rootGroups.forEach(g => {
      map[g.id] = (tree.tasksByParent[g.id] || []).map(t => t.id)
    })
    return map
  }, [tree])

  // ── Columns ──
  const columns: Column[] = useMemo(() => {
    const base: Column[] = [
      { key: 'drag',        label: '',            width: '28px' },
      { key: 'expand',      label: '',            width: '28px' },
      { key: 'check',       label: '',            width: '32px' },
      { key: 'title',       label: 'Tarefa',      width: 'minmax(260px, 1fr)', sortable: true },
      { key: 'plannedDate', label: 'Prazo',        width: '130px', sortable: true, align: 'center' },
      { key: 'status',      label: 'Status',       width: '150px', sortable: true },
      { key: 'responsible', label: 'Responsável',  width: '150px' },
      { key: 'progress',    label: '%',            width: '80px',  sortable: true, align: 'center' },
    ]
    customCols.forEach(c => base.push({
      key: `col_${c.id}`,
      label: c.label,
      width: COL_WIDTH[c.type] || '160px',
      sortable: true,
      colId: c.id,
      align: COL_ALIGN[c.type],
    }))
    base.push({ key: 'updatedAt',  label: 'Atualizado', width: '130px', sortable: true })
    base.push({ key: 'addCol',     label: '',            width: '36px' })
    base.push({ key: 'rowActions', label: '',            width: '52px' })
    return base
  }, [customCols])

  // ── Visible columns (minus hidden) ──
  const visibleColumns = useMemo(
    () => columns.filter(c => !hiddenCols.has(c.key)),
    [columns, hiddenCols]
  )
  const gridTemplate = visibleColumns.map(c => c.width).join(' ')

  function setFilter(key: string, f: ColFilter | null) {
    setColFilters(prev => {
      if (!f) { const next = { ...prev }; delete next[key]; return next }
      return { ...prev, [key]: f }
    })
  }

  function toggleSort(key: string) {
    setSort(curr => {
      if (!curr || curr.key !== key) return { key, dir: 'asc' }
      if (curr.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  function SortIcon({ sortKey }: { sortKey: string }) {
    if (!sort || sort.key !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-0.5 shrink-0" />
    return sort.dir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-primary ml-0.5 shrink-0" />
      : <ArrowDown className="h-3 w-3 text-primary ml-0.5 shrink-0" />
  }

  const statusOptions = (Object.entries(MILESTONE_STATUS_LABELS) as Array<[MilestoneStatus, string]>)
    .map(([value, label]) => ({ value, label }))

  function HeaderCell({ col }: { col: Column }) {
    if (col.key === 'addCol') return (
      <button type="button" onClick={onOpenColumnsManager}
        className="flex items-center justify-center text-muted-foreground hover:text-primary border-l hover:bg-muted/50 transition-colors"
        title="Adicionar coluna"><Plus className="h-3.5 w-3.5" /></button>
    )
    if (['drag', 'expand', 'check', 'rowActions'].includes(col.key)) return <div className="border-l first:border-l-0" />

    const customCol = col.colId ? customCols.find(c => c.id === col.colId) : undefined
    const colFilter = colFilters[col.key]
    const isFiltered = colFilter ? isFilterActive(colFilter) : false
    const canHide = !NON_HIDEABLE.has(col.key)

    return (
      <div
        onClick={col.sortable ? () => toggleSort(col.key) : undefined}
        className={`px-2 py-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground border-l flex items-center gap-1 select-none overflow-hidden ${col.sortable ? 'cursor-pointer hover:bg-muted/50' : ''} ${col.align === 'center' ? 'justify-center' : ''}`}
      >
        {isFiltered && <Filter className="h-3 w-3 text-primary shrink-0" />}
        <span className="truncate min-w-0" title={col.label}>{col.label}</span>
        {col.sortable && <SortIcon sortKey={col.key} />}
        <ColumnActionsMenu
          col={col}
          customCol={customCol}
          sort={sort}
          onSort={(dir) => setSort({ key: col.key, dir })}
          onClearSort={() => setSort(null)}
          colFilter={colFilter}
          onFilter={(f) => setFilter(col.key, f)}
          canHide={canHide}
          onHide={() => setHiddenCols(prev => new Set([...prev, col.key]))}
          canEdit={canEdit}
          onRename={onRenameColumn}
          onDelete={onDeleteColumn}
          users={users}
          milestoneStatusOptions={statusOptions}
          customColOptions={customCol?.options?.values?.map(o => ({ value: o.value, label: o.label }))}
        />
      </div>
    )
  }

  // ── Inline create row ─────────────────────────────────────────────────────
  // groupRow=true  → só renderiza quando kind==='group'
  // groupRow=false → só renderiza quando kind!=='group'
  function InlineCreateRow({ groupId, groupRow = false }: { groupId: string | null; groupRow?: boolean }) {
    if (!inlineCreate || inlineCreate.groupId !== groupId) return null
    if (groupRow && inlineCreate.kind !== 'group') return null
    if (!groupRow && inlineCreate.kind === 'group') return null
    const label = inlineCreate.kind === 'group' ? 'grupo' : inlineCreate.kind === 'task' ? 'tarefa' : 'subtarefa'
    return (
      <div className="grid border-b bg-primary/3" style={{ gridTemplateColumns: gridTemplate }}>
        <div /><div /><div />
        <div className="px-2 py-1.5 flex items-center gap-2" style={{ gridColumn: `4 / ${visibleColumns.length - 1}` }}>
          <input
            ref={inlineInputRef}
            value={inlineTitle}
            onChange={e => setInlineTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitInlineCreate(true)
              if (e.key === 'Escape') { setInlineCreate(null); setInlineTitle('') }
            }}
            placeholder={`Nome do ${label}... (Enter para salvar, Esc para cancelar)`}
            disabled={inlineSaving}
            className="flex-1 h-7 px-2 text-sm rounded border border-primary bg-background focus:outline-none"
          />
          <button type="button" onClick={() => commitInlineCreate(false)} disabled={!inlineTitle.trim() || inlineSaving}
            className="h-7 px-3 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50 shrink-0">
            {inlineSaving ? '...' : 'Salvar'}
          </button>
          <button type="button" onClick={() => { setInlineCreate(null); setInlineTitle('') }}
            className="h-7 px-2 text-xs rounded border text-muted-foreground hover:bg-muted shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // ── DnD handlers ─────────────────────────────────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const activeIdStr = String(active.id)
    const overIdStr   = String(over.id)
    for (const [gid, ids] of Object.entries(idsByGroup)) {
      if (ids.includes(activeIdStr) && ids.includes(overIdStr)) {
        const groupId = gid === '__root__' ? null : gid
        const newIds = arrayMove(ids, ids.indexOf(activeIdStr), ids.indexOf(overIdStr))
        onReorderGroup(groupId, newIds)
        return
      }
    }
  }

  const activeTask = activeId ? items.find(i => i.id === activeId) : null

  const vcLen = visibleColumns.length

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={e => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <>
        {/* Active filters / hidden cols bar */}
        {(hasActiveFilters || hiddenCols.size > 0) && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-primary/5 border-b text-xs text-muted-foreground">
            {hasActiveFilters && (
              <button type="button"
                onClick={() => setColFilters({})}
                className="flex items-center gap-1.5 text-primary hover:underline">
                <X className="h-3 w-3" />
                Limpar filtros
              </button>
            )}
            {hiddenCols.size > 0 && (
              <button type="button"
                onClick={() => setHiddenCols(new Set())}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Eye className="h-3 w-3" />
                Restaurar {hiddenCols.size} coluna{hiddenCols.size !== 1 ? 's' : ''} oculta{hiddenCols.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto border-t">
          <div className="min-w-max">
            {/* HEADER */}
            <div className="grid sticky top-0 bg-muted/40 border-b z-10" style={{ gridTemplateColumns: gridTemplate }}>
              {visibleColumns.map(c => <HeaderCell key={c.key} col={c} />)}
            </div>

            {/* ROWS */}
            {flatRows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground italic text-center">
                {hasActiveFilters
                  ? 'Nenhuma tarefa corresponde aos filtros ativos.'
                  : `Nenhuma tarefa. ${canEdit ? 'Use os botões acima para criar um grupo ou tarefa.' : ''}`
                }
              </div>
            ) : (() => {
              const elements: ReactNode[] = []

              for (let rowIdx = 0; rowIdx < flatRows.length; rowIdx++) {
                const r = flatRows[rowIdx]

                // ── ADD-GROUP ROW ─────────────────────────────────────────
                if (r._type === 'add-group') {
                  elements.push(
                    <div key="add-group">
                      <InlineCreateRow groupId={null} groupRow={true} />
                      {(!inlineCreate || inlineCreate.kind !== 'group') && (
                        <div className="grid border-b" style={{ gridTemplateColumns: gridTemplate }}>
                          <div /><div /><div />
                          <div className="px-2 py-1.5" style={{ gridColumn: `4 / ${vcLen + 1}` }}>
                            <button type="button"
                              onClick={() => openInlineCreate('group', null, null)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5">
                              <Plus className="h-3.5 w-3.5" />
                              <span className="font-medium">Novo grupo</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                  continue
                }

                // ── FOOTER ROW ────────────────────────────────────────────
                if (r._type === 'footer') {
                  elements.push(
                    <div key={`footer_${r.groupId}`} className="grid border-b bg-muted/10" style={{ gridTemplateColumns: gridTemplate }}>
                      <div /><div /><div />
                      <div className="px-2 py-1 text-[11px] text-muted-foreground flex items-center gap-3" style={{ gridColumn: `4 / ${vcLen + 1}` }}>
                        <span className={`font-semibold ${r.done === r.total && r.total > 0 ? 'text-emerald-600' : ''}`}>
                          {r.done}/{r.total} concluídas
                        </span>
                        <span>·</span>
                        <span>{r.avgPct}% médio</span>
                        {r.done === r.total && r.total > 0 && <span className="text-emerald-600 font-semibold">✓ Grupo completo</span>}
                      </div>
                    </div>
                  )
                  continue
                }

                // ── ADD ROW ───────────────────────────────────────────────
                if (r._type === 'add') {
                  const gid = r.groupId
                  elements.push(
                    <div key={`add_${gid ?? 'root'}_${rowIdx}`}>
                      <InlineCreateRow groupId={gid} />
                      {(!inlineCreate || inlineCreate.groupId !== gid) && (
                        <div className="grid border-b" style={{ gridTemplateColumns: gridTemplate }}>
                          <div /><div /><div />
                          <div className="px-2 py-1" style={{ gridColumn: `4 / ${vcLen + 1}` }}>
                            <button type="button"
                              onClick={() => openInlineCreate('task', gid, gid)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors w-full py-0.5">
                              <Plus className="h-3.5 w-3.5" />
                              <span>Adicionar tarefa</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                  continue
                }

                const { task: t, level, groupId: taskGroupId } = r

                // ── GROUP ROW ─────────────────────────────────────────────
                if (level === 0) {
                  const isCollapsed = collapsed.has(t.id)
                  const childCount = (tree.tasksByParent[t.id] || []).length
                  elements.push(
                    <div key={t.id} className="grid bg-primary/5 border-b font-semibold" style={{ gridTemplateColumns: gridTemplate }}>
                      <div />
                      <button onClick={() => onToggleCollapse(t.id)} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      <div />
                      <div className="px-2 py-1.5 text-sm flex items-center gap-2 overflow-hidden" style={{ gridColumn: `4 / ${vcLen + 1}` }}>
                        <span className="truncate">{t.title}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground font-normal">{childCount} tarefa{childCount !== 1 ? 's' : ''}</span>
                        <span className={`text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 ${MILESTONE_STATUS_COLORS[t.status]}`}>
                          {MILESTONE_STATUS_LABELS[t.status]}
                        </span>
                        {canEdit && (
                          <span className="ml-auto flex items-center gap-1">
                            <button type="button" onClick={() => openInlineCreate('task', t.id, t.id)} className="text-muted-foreground hover:text-primary" title="Adicionar tarefa">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => onDeleteTask(t)} className="text-muted-foreground hover:text-rose-600" title="Remover grupo">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                  continue
                }

                // ── TASK / SUBTASK ROW ────────────────────────────────────
                const isSubtask   = level === 2
                const hasChildren = !isSubtask && (tree.subtasksByParent[t.id]?.length || 0) > 0
                const isCollapsedTask = collapsed.has(t.id)
                const isEditingTitle  = editingTitleId === t.id
                const isDraggable     = canEdit && !isSubtask && !sort

                const rowContent = (drag: ReactNode) => {
                  // Build only cells for visible columns
                  const cellMap: Record<string, ReactNode> = {}

                  cellMap['drag'] = <div key="drag" className="border-l first:border-l-0">{drag}</div>

                  cellMap['expand'] = (
                    <div key="expand" className="flex items-center justify-center border-l">
                      {hasChildren && (
                        <button onClick={() => onToggleCollapse(t.id)} className="text-muted-foreground hover:text-foreground">
                          {isCollapsedTask ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  )

                  cellMap['check'] = (
                    <button key="check" type="button" disabled={!canEdit}
                      onClick={() => canEdit && onUpdateTask(t.id, {
                        status: t.status === 'done' ? 'in_progress' : 'done',
                        completedDate: t.status === 'done' ? null : undefined,
                      })}
                      className="flex items-center justify-center text-muted-foreground hover:text-emerald-600 disabled:cursor-not-allowed border-l">
                      {t.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
                    </button>
                  )

                  cellMap['title'] = (
                    <div key="title" className="px-2 py-1.5 text-sm flex items-center gap-1.5 border-l overflow-hidden">
                      {isSubtask && <span className="ml-3 text-muted-foreground text-xs shrink-0">↳</span>}
                      {isEditingTitle ? (
                        <input ref={titleInputRef} value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                          onBlur={() => commitTitle(t.id)}
                          onKeyDown={e => { if (e.key === 'Enter') commitTitle(t.id); if (e.key === 'Escape') setEditingTitleId(null) }}
                          className="flex-1 min-w-0 h-7 px-1.5 text-sm rounded border border-primary bg-background focus:outline-none" />
                      ) : (
                        <span onClick={() => startEditTitle(t)} title={canEdit ? 'Clique para editar' : t.title}
                          className={`truncate ${t.status === 'done' ? 'line-through text-muted-foreground' : ''} ${canEdit ? 'cursor-text hover:underline decoration-dashed underline-offset-2' : ''}`}>
                          {t.title}
                        </span>
                      )}
                      {!isSubtask && !!subtaskCount[t.id] && (
                        <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold shrink-0">
                          {subtaskCount[t.id]}
                        </span>
                      )}
                    </div>
                  )

                  cellMap['plannedDate'] = (
                    <div key="plannedDate" className="px-1 py-1 border-l flex items-center justify-center">
                      {canEdit ? (
                        <input type="date" value={t.plannedDate || ''}
                          onChange={e => onUpdateTask(t.id, { plannedDate: e.target.value || null })}
                          className="w-full h-7 px-1 text-xs rounded border-0 bg-transparent hover:bg-muted/40 focus:bg-background focus:border focus:outline-none text-center" />
                      ) : (
                        <span className="text-xs text-muted-foreground tabular-nums">{fmtDate(t.plannedDate)}</span>
                      )}
                    </div>
                  )

                  cellMap['status'] = (
                    <div key="status" className="px-1 py-1 border-l flex items-center justify-center">
                      <Combobox options={statusOptions} value={t.status}
                        onChange={v => canEdit && onUpdateTask(t.id, { status: v as MilestoneStatus, completedDate: v !== 'done' ? null : undefined })}
                        disabled={!canEdit} className="w-full" />
                    </div>
                  )

                  cellMap['responsible'] = (
                    <div key="responsible" className="px-1.5 py-1 border-l flex items-center">
                      <MultiPeoplePicker value={t.responsibleIds} users={users}
                        onChange={ids => onUpdateTask(t.id, { responsibleIds: ids })} disabled={!canEdit} />
                    </div>
                  )

                  cellMap['progress'] = (
                    <div key="progress" className="px-1 py-1 border-l flex items-center justify-center">
                      {canEdit ? (
                        <input type="number" min={0} max={100} value={t.progressPct ?? ''}
                          onChange={e => onUpdateTask(t.id, { progressPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          className="w-14 h-7 px-1 text-xs rounded border bg-background tabular-nums text-center" />
                      ) : (
                        <span className="text-xs tabular-nums">{t.progressPct ?? 0}%</span>
                      )}
                    </div>
                  )

                  // custom cols
                  customCols.forEach((c) => {
                    const value = valuesByTaskCol[t.id]?.[c.id]?.value ?? null
                    const colAlign = COL_ALIGN[c.type]
                    const alignCls = colAlign === 'center' ? 'justify-center' : colAlign === 'right' ? 'justify-end' : ''
                    cellMap[`col_${c.id}`] = (
                      <div key={`col_${c.id}`} className={`px-1.5 py-1 border-l flex items-center overflow-hidden ${alignCls}`}>
                        {canEdit
                          ? <ColumnCellEditor column={c} value={value} onChange={v => onPutColumnValue(t.id, c.id, v)} />
                          : (c.type === 'select' || c.type === 'status')
                            ? <SelectPill column={c} value={value} />
                            : <ColumnCellReadonly column={c} value={value} />
                        }
                      </div>
                    )
                  })

                  cellMap['updatedAt'] = (
                    <div key="updatedAt" className="px-2 py-1 border-l flex items-center gap-1.5 text-[11px] text-muted-foreground"
                      title={t.updatedAt ? new Date(t.updatedAt).toLocaleString('pt-BR') : ''}>
                      {t.responsibleIds[0] ? (
                        <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
                          {initials(users.find(u => u.id === t.responsibleIds[0])?.name || '?')}
                        </div>
                      ) : <UserCircle2 className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                      <span className="truncate">{relativeTime(t.updatedAt)}</span>
                    </div>
                  )

                  cellMap['addCol'] = <div key="addCol" className="border-l" />

                  cellMap['rowActions'] = (
                    <div key="actions" className="border-l flex items-center justify-center gap-0.5">
                      {canEdit && !isSubtask && (
                        <button type="button"
                          onClick={() => openInlineCreate('subtask', t.id, taskGroupId ?? null)}
                          className="text-muted-foreground hover:text-primary p-1" title="Subtarefa">
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                      {canEdit && (
                        <button type="button" onClick={() => onDeleteTask(t)}
                          className="text-muted-foreground hover:text-rose-600 p-1" title="Remover">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )

                  // Render only visible columns
                  return (
                    <div className={`grid border-b hover:bg-muted/20 transition-colors ${isSubtask ? 'bg-muted/10' : ''}`}
                      style={{ gridTemplateColumns: gridTemplate }}>
                      {visibleColumns.map(c => cellMap[c.key])}
                    </div>
                  )
                }

                if (isDraggable) {
                  elements.push(
                    <SortableRow key={t.id} id={t.id} disabled={!isDraggable}>
                      {drag => rowContent(drag)}
                    </SortableRow>
                  )
                } else {
                  elements.push(
                    <div key={t.id}>
                      {rowContent(<div />)}
                    </div>
                  )
                }
              }

              return elements
            })()}
          </div>
        </div>
      </>

      {/* DnD overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="grid border rounded shadow-lg bg-background opacity-95 text-sm px-4 py-2"
            style={{ gridTemplateColumns: '28px 28px 32px 1fr', minWidth: 320 }}>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div />
            <Circle className="h-4 w-4 text-muted-foreground" />
            <span className="px-2 truncate">{activeTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
