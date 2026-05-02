/**
 * Tabela tipo Excel (Phase 3 Sprint 3.6 + 3.7) para o Cronograma do projeto.
 *
 * Sprint 3.7 — novas features:
 *   - Edit inline do título (click → input, blur/Enter salva)
 *   - Linha "+ Adicionar tarefa" ao fim de cada grupo / lista root
 *   - Menu ⋯ por coluna custom (Renomear / Excluir)
 *   - Pill colorida em readonly de select (auto-cor por índice de opção)
 *
 * Responsividade: overflow-x-auto no wrapper externo; toolbar/header wrapam
 * em telas estreitas; grid min-w-max garante scroll horizontal controlado.
 */
import {
  ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronDown, ChevronRight,
  Circle, MoreHorizontal, Pencil, Plus, Trash2, UserCircle2, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  MILESTONE_STATUS_COLORS, MILESTONE_STATUS_LABELS,
  type MilestoneStatus, type ProjectMilestone,
} from '@/features/projects2/milestones-types'
import type { ProjectTaskColumn, TaskColumnValue } from '@/features/projects2/task-columns-types'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { ColumnCellEditor, ColumnCellReadonly } from '@/features/projects2/components/ColumnCellEditor'

interface UserMini { id: string; name: string; email: string }

export interface TableSort {
  key: string
  dir: 'asc' | 'desc'
}

// Paleta auto para pills de select/status custom (índice de opção → cor)
const PILL_PALETTE = [
  'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-300',
]

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
  onAddTaskInGroup: (groupId: string) => void
  onAddSubtaskInTask: (taskId: string) => void
  onAddRootTask: () => void
  onPutColumnValue: (taskId: string, colId: string, value: any) => void
  onOpenColumnsManager: () => void
  onRenameColumn?: (colId: string, newLabel: string) => void
  onDeleteColumn?: (colId: string) => void
  subtaskCount: Record<string, number>
}

interface Column {
  key: string
  label: string
  width: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  colId?: string
}

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
    const min = Math.round(sec / 60)
    if (min < 60) return `${min}m`
    const hr = Math.round(min / 60)
    if (hr < 24) return `${hr}h`
    const day = Math.round(hr / 24)
    if (day < 7) return `${day}d`
    if (day < 30) return `${Math.round(day / 7)}sem`
    if (day < 365) return `${Math.round(day / 30)}mes`
    return `${Math.round(day / 365)}ano`
  } catch { return '' }
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

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
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="w-full h-7 px-2 text-xs rounded border bg-background hover:bg-muted disabled:opacity-60 flex items-center gap-1"
      >
        {selected.length === 0 ? (
          <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground/40" />
        ) : (
          <div className="flex -space-x-1">
            {selected.slice(0, 3).map(u => (
              <div key={u.id} title={u.name} className="h-5 w-5 rounded-full ring-2 ring-background bg-primary/15 text-primary flex items-center justify-center text-[9px] font-semibold">
                {initials(u.name)}
              </div>
            ))}
            {selected.length > 3 && (
              <div className="h-5 w-5 rounded-full ring-2 ring-background bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-semibold">
                +{selected.length - 3}
              </div>
            )}
          </div>
        )}
        <span className="ml-auto text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 max-h-72 overflow-auto rounded-md border bg-popover shadow-md">
          <div className="p-1.5 border-b">
            <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="h-7 text-xs" />
          </div>
          <ul className="py-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-1 text-xs text-muted-foreground italic">Sem resultados</li>
            ) : filtered.map(u => {
              const checked = value.includes(u.id)
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onChange(checked ? value.filter(x => x !== u.id) : [...value, u.id])}
                    className={`w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted text-left ${checked ? 'font-medium' : ''}`}
                  >
                    <input type="checkbox" checked={checked} readOnly className="h-3 w-3" />
                    <span className="truncate">{u.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── ColumnHeaderMenu — Sprint 3.7 ───────────────────────────────────────────
function ColumnHeaderMenu({
  col, onRename, onDelete,
}: {
  col: ProjectTaskColumn
  onRename: (colId: string, label: string) => void
  onDelete: (colId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(col.label)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setRenaming(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  useEffect(() => { if (renaming) inputRef.current?.focus() }, [renaming])

  function commitRename() {
    if (draft.trim() && draft !== col.label) onRename(col.id, draft.trim())
    setRenaming(false); setOpen(false)
  }

  return (
    <div ref={ref} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center justify-center h-5 w-5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        title="Opções da coluna"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && !renaming && (
        <div className="absolute z-50 top-full right-0 mt-1 w-40 rounded-md border bg-popover shadow-md py-1">
          <button
            type="button"
            onClick={() => { setDraft(col.label); setRenaming(true) }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left"
          >
            <Pencil className="h-3 w-3" /> Renomear
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(col.id) }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-rose-600 text-left"
          >
            <Trash2 className="h-3 w-3" /> Excluir coluna
          </button>
        </div>
      )}
      {open && renaming && (
        <div className="absolute z-50 top-full right-0 mt-1 w-52 rounded-md border bg-popover shadow-md p-2 space-y-2">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Renomear coluna</p>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setRenaming(false); setOpen(false) }
            }}
            className="w-full h-7 px-2 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-1 justify-end">
            <button type="button" onClick={() => { setRenaming(false); setOpen(false) }} className="px-2 py-1 text-xs rounded hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
            <button type="button" onClick={commitRename} className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pill colorida para select/status readonly — Sprint 3.7 ──────────────────
function SelectPill({ column, value, colIndex }: { column: ProjectTaskColumn; value: any; colIndex: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">-</span>
  const opts = column.options?.values || []
  const opt = opts.find(o => o.value === value)
  const label = opt?.label || value
  const optIdx = opts.findIndex(o => o.value === value)
  const pillCls = PILL_PALETTE[(optIdx >= 0 ? optIdx : colIndex) % PILL_PALETTE.length]
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full truncate max-w-full ${pillCls}`}>
      {label}
    </span>
  )
}

// ─── Row types ────────────────────────────────────────────────────────────────
interface FlatRow {
  _type: 'task'
  task: ProjectMilestone
  level: 0 | 1 | 2
  groupId?: string
}
interface AddRow {
  _type: 'add'
  groupId: string | null
}
type Row = FlatRow | AddRow

// ─── TasksTableView ───────────────────────────────────────────────────────────
export function TasksTableView({
  items, customCols, valuesByTaskCol, users, canEdit,
  collapsed, onToggleCollapse, onUpdateTask, onDeleteTask,
  onAddTaskInGroup, onAddSubtaskInTask, onAddRootTask,
  onPutColumnValue, onOpenColumnsManager,
  onRenameColumn, onDeleteColumn,
  subtaskCount,
}: Props) {
  const [sort, setSort] = useState<TableSort | null>(null)
  // Sprint 3.7: edição inline do título
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editingTitleId) titleInputRef.current?.focus() }, [editingTitleId])

  function startEditTitle(t: ProjectMilestone) {
    if (!canEdit) return
    setEditingTitleId(t.id)
    setTitleDraft(t.title)
  }

  function commitTitle(taskId: string) {
    if (titleDraft.trim()) onUpdateTask(taskId, { title: titleDraft.trim() })
    setEditingTitleId(null)
  }

  // Árvore
  const tree = useMemo(() => {
    const rootGroups = items.filter(i => i.kind === 'group' && !i.parentId)
    const rootTasks = items.filter(i => i.kind === 'task' && !i.parentId)
    const tasksByParent: Record<string, ProjectMilestone[]> = {}
    const subtasksByParent: Record<string, ProjectMilestone[]> = {}
    items.forEach(i => {
      if (i.parentId && i.kind === 'task') (tasksByParent[i.parentId] = tasksByParent[i.parentId] || []).push(i)
      else if (i.parentId && i.kind === 'subtask') (subtasksByParent[i.parentId] = subtasksByParent[i.parentId] || []).push(i)
    })
    return { rootGroups, rootTasks, tasksByParent, subtasksByParent }
  }, [items])

  function sortArr(arr: ProjectMilestone[]): ProjectMilestone[] {
    if (!sort) return arr
    const out = arr.slice()
    out.sort((a, b) => {
      let av: any = ''; let bv: any = ''
      if (sort.key === 'title') { av = a.title; bv = b.title }
      else if (sort.key === 'plannedDate') { av = a.plannedDate || '\uffff'; bv = b.plannedDate || '\uffff' }
      else if (sort.key === 'status') { av = a.status; bv = b.status }
      else if (sort.key === 'progress') { av = a.progressPct || 0; bv = b.progressPct || 0 }
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

  // Flat rows com sentinelas "+ add" (Sprint 3.7)
  const flatRows: Row[] = useMemo(() => {
    const out: Row[] = []
    sortArr(tree.rootTasks).forEach((t) => {
      out.push({ _type: 'task', task: t, level: 1 })
      if (!collapsed.has(t.id)) {
        sortArr(tree.subtasksByParent[t.id] || []).forEach((s) => out.push({ _type: 'task', task: s, level: 2 }))
      }
    })
    if (canEdit) out.push({ _type: 'add', groupId: null })

    tree.rootGroups.forEach((g) => {
      out.push({ _type: 'task', task: g, level: 0 })
      if (!collapsed.has(g.id)) {
        sortArr(tree.tasksByParent[g.id] || []).forEach((t) => {
          out.push({ _type: 'task', task: t, level: 1, groupId: g.id })
          if (!collapsed.has(t.id)) {
            sortArr(tree.subtasksByParent[t.id] || []).forEach((s) => {
              out.push({ _type: 'task', task: s, level: 2, groupId: g.id })
            })
          }
        })
        if (canEdit) out.push({ _type: 'add', groupId: g.id })
      }
    })
    return out
  }, [tree, collapsed, sort, valuesByTaskCol, canEdit])

  // Colunas do grid
  const columns: Column[] = useMemo(() => {
    const base: Column[] = [
      { key: 'expand', label: '', width: '28px' },
      { key: 'check', label: '', width: '32px' },
      { key: 'title', label: 'Tarefa', width: 'minmax(260px, 1fr)', sortable: true },
      { key: 'plannedDate', label: 'Prazo', width: '110px', sortable: true },
      { key: 'status', label: 'Status', width: '150px', sortable: true },
      { key: 'responsible', label: 'Responsável', width: '150px' },
      { key: 'progress', label: '%', width: '80px', sortable: true, align: 'center' },
    ]
    customCols.forEach((c) => {
      base.push({ key: `col_${c.id}`, label: c.label, width: '160px', sortable: true, colId: c.id })
    })
    base.push({ key: 'updatedAt', label: 'Atualizado', width: '130px', sortable: true })
    base.push({ key: 'addCol', label: '', width: '36px' })
    base.push({ key: 'rowActions', label: '', width: '52px' })
    return base
  }, [customCols])

  const gridTemplate = columns.map(c => c.width).join(' ')

  function toggleSort(key: string) {
    setSort(curr => {
      if (!curr || curr.key !== key) return { key, dir: 'asc' }
      if (curr.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  function SortIcon({ sortKey }: { sortKey: string }) {
    if (!sort || sort.key !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-0.5" />
    return sort.dir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-primary ml-0.5" />
      : <ArrowDown className="h-3 w-3 text-primary ml-0.5" />
  }

  function HeaderCell({ col }: { col: Column }) {
    if (col.key === 'addCol') {
      return (
        <button
          type="button"
          onClick={onOpenColumnsManager}
          className="flex items-center justify-center text-muted-foreground hover:text-primary border-l hover:bg-muted/50 transition-colors"
          title="Adicionar coluna"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )
    }
    if (col.key === 'expand' || col.key === 'check' || col.key === 'rowActions') {
      return <div className="border-l first:border-l-0" />
    }
    const customCol = col.colId ? customCols.find(c => c.id === col.colId) : null
    return (
      <div
        onClick={col.sortable ? () => toggleSort(col.key) : undefined}
        className={`px-2 py-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground border-l flex items-center gap-1 select-none ${col.sortable ? 'cursor-pointer hover:bg-muted/50' : ''} ${col.align === 'center' ? 'justify-center' : ''}`}
        title={col.sortable && !customCol ? 'Ordenar' : ''}
      >
        <span className="whitespace-nowrap">{col.label}</span>
        {col.sortable && <SortIcon sortKey={col.key} />}
        {customCol && canEdit && onRenameColumn && onDeleteColumn && (
          <ColumnHeaderMenu col={customCol} onRename={onRenameColumn} onDelete={onDeleteColumn} />
        )}
      </div>
    )
  }

  const statusOptions = (Object.entries(MILESTONE_STATUS_LABELS) as Array<[MilestoneStatus, string]>)
    .map(([value, label]) => ({ value, label }))

  return (
    <div className="overflow-x-auto border-t">
      <div className="min-w-max">
        {/* HEADER */}
        <div className="grid sticky top-0 bg-muted/40 border-b z-10" style={{ gridTemplateColumns: gridTemplate }}>
          {columns.map(c => <HeaderCell key={c.key} col={c} />)}
        </div>

        {/* ROWS */}
        {flatRows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground italic text-center">
            Nenhuma tarefa. {canEdit && 'Crie um grupo ou tarefa para começar.'}
          </div>
        ) : flatRows.map((r, rowIdx) => {

          // ── ADD ROW (Sprint 3.7) ──────────────────────────────────────────
          if (r._type === 'add') {
            return (
              <div key={`add_${r.groupId ?? 'root'}_${rowIdx}`} className="grid border-b" style={{ gridTemplateColumns: gridTemplate }}>
                <div /><div />
                <div className="px-2 py-1" style={{ gridColumn: `3 / ${columns.length + 1}` }}>
                  <button
                    type="button"
                    onClick={() => r.groupId ? onAddTaskInGroup(r.groupId) : onAddRootTask()}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors w-full py-0.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Adicionar tarefa</span>
                  </button>
                </div>
              </div>
            )
          }

          const { task: t, level } = r

          // ── GROUP ROW ─────────────────────────────────────────────────────
          if (level === 0) {
            const isCollapsed = collapsed.has(t.id)
            const childCount = (tree.tasksByParent[t.id] || []).length
            return (
              <div key={t.id} className="grid bg-primary/5 border-b font-semibold" style={{ gridTemplateColumns: gridTemplate }}>
                <button onClick={() => onToggleCollapse(t.id)} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <div />
                <div className="px-2 py-1.5 text-sm flex items-center gap-2 overflow-hidden" style={{ gridColumn: `3 / ${columns.length + 1}` }}>
                  <span className="truncate">{t.title}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground font-normal">{childCount} tarefa{childCount !== 1 ? 's' : ''}</span>
                  <span className={`text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 ${MILESTONE_STATUS_COLORS[t.status]}`}>
                    {MILESTONE_STATUS_LABELS[t.status]}
                  </span>
                  {canEdit && (
                    <span className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={() => onAddTaskInGroup(t.id)} className="text-muted-foreground hover:text-primary" title="Adicionar tarefa">
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
          }

          // ── TASK / SUBTASK ROW ────────────────────────────────────────────
          const isSubtask = level === 2
          const hasChildren = !isSubtask && (tree.subtasksByParent[t.id]?.length || 0) > 0
          const isCollapsedTask = collapsed.has(t.id)
          const isEditingTitle = editingTitleId === t.id
          const cells: ReactNode[] = []

          // 1) expand
          cells.push(
            <div key="expand" className="flex items-center justify-center">
              {hasChildren && (
                <button onClick={() => onToggleCollapse(t.id)} className="text-muted-foreground hover:text-foreground">
                  {isCollapsedTask ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>,
          )

          // 2) check
          cells.push(
            <button
              key="check"
              type="button"
              disabled={!canEdit}
              onClick={() => canEdit && onUpdateTask(t.id, {
                status: t.status === 'done' ? 'in_progress' : 'done',
                completedDate: t.status === 'done' ? null : undefined,
              })}
              className="flex items-center justify-center text-muted-foreground hover:text-emerald-600 disabled:cursor-not-allowed border-l"
            >
              {t.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
            </button>,
          )

          // 3) title — Sprint 3.7: click to edit
          cells.push(
            <div key="title" className="px-2 py-1.5 text-sm flex items-center gap-1.5 border-l overflow-hidden">
              {isSubtask && <span className="ml-3 text-muted-foreground text-xs shrink-0">↳</span>}
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onBlur={() => commitTitle(t.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitTitle(t.id)
                    if (e.key === 'Escape') setEditingTitleId(null)
                  }}
                  className="flex-1 min-w-0 h-7 px-1.5 text-sm rounded border border-primary bg-background focus:outline-none"
                />
              ) : (
                <span
                  onClick={() => startEditTitle(t)}
                  title={canEdit ? 'Clique para editar' : t.title}
                  className={`truncate ${t.status === 'done' ? 'line-through text-muted-foreground' : ''} ${canEdit ? 'cursor-text hover:underline decoration-dashed underline-offset-2' : ''}`}
                >
                  {t.title}
                </span>
              )}
              {!isSubtask && !!subtaskCount[t.id] && (
                <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold shrink-0">
                  {subtaskCount[t.id]}
                </span>
              )}
            </div>,
          )

          // 4) plannedDate
          cells.push(
            <div key="plannedDate" className="px-2 py-1 border-l flex items-center">
              {canEdit ? (
                <input
                  type="date"
                  value={t.plannedDate || ''}
                  onChange={(e) => onUpdateTask(t.id, { plannedDate: e.target.value || null })}
                  className="w-full h-7 px-1.5 text-xs rounded border-0 bg-transparent hover:bg-muted/40 focus:bg-background focus:border focus:outline-none"
                />
              ) : (
                <span className="text-xs text-muted-foreground tabular-nums">{fmtDate(t.plannedDate)}</span>
              )}
            </div>,
          )

          // 5) status
          cells.push(
            <div key="status" className="px-1 py-1 border-l flex items-center">
              <Combobox
                options={statusOptions}
                value={t.status}
                onChange={(v) => canEdit && onUpdateTask(t.id, {
                  status: v as MilestoneStatus,
                  completedDate: v !== 'done' ? null : undefined,
                })}
                disabled={!canEdit}
              />
            </div>,
          )

          // 6) responsible
          cells.push(
            <div key="responsible" className="px-1.5 py-1 border-l flex items-center">
              <MultiPeoplePicker
                value={t.responsibleIds}
                users={users}
                onChange={(ids) => onUpdateTask(t.id, { responsibleIds: ids })}
                disabled={!canEdit}
              />
            </div>,
          )

          // 7) progress
          cells.push(
            <div key="progress" className="px-1 py-1 border-l flex items-center justify-center">
              {canEdit ? (
                <input
                  type="number"
                  min={0} max={100}
                  value={t.progressPct ?? ''}
                  onChange={(e) => onUpdateTask(t.id, { progressPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  className="w-14 h-7 px-1 text-xs rounded border bg-background tabular-nums text-center"
                />
              ) : (
                <span className="text-xs tabular-nums">{t.progressPct ?? 0}%</span>
              )}
            </div>,
          )

          // 8) custom cols — Sprint 3.7: pill colorida em readonly
          customCols.forEach((c, ci) => {
            const value = valuesByTaskCol[t.id]?.[c.id]?.value ?? null
            cells.push(
              <div key={`col_${c.id}`} className="px-1.5 py-1 border-l flex items-center overflow-hidden">
                {canEdit
                  ? <ColumnCellEditor column={c} value={value} onChange={(v) => onPutColumnValue(t.id, c.id, v)} />
                  : (c.type === 'select' || c.type === 'status')
                    ? <SelectPill column={c} value={value} colIndex={ci} />
                    : <ColumnCellReadonly column={c} value={value} />
                }
              </div>,
            )
          })

          // 9) updatedAt
          cells.push(
            <div key="updatedAt" className="px-2 py-1 border-l flex items-center gap-1.5 text-[11px] text-muted-foreground" title={t.updatedAt ? new Date(t.updatedAt).toLocaleString('pt-BR') : ''}>
              {t.responsibleIds[0] ? (
                <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
                  {initials(users.find(u => u.id === t.responsibleIds[0])?.name || '?')}
                </div>
              ) : (
                <UserCircle2 className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              )}
              <span className="truncate">{relativeTime(t.updatedAt)}</span>
            </div>,
          )

          // 10) addCol slot
          cells.push(<div key="addCol" className="border-l" />)

          // 11) row actions
          cells.push(
            <div key="actions" className="border-l flex items-center justify-center gap-0.5">
              {canEdit && !isSubtask && (
                <button type="button" onClick={() => onAddSubtaskInTask(t.id)} className="text-muted-foreground hover:text-primary p-1" title="Subtarefa">
                  <Plus className="h-3 w-3" />
                </button>
              )}
              {canEdit && (
                <button type="button" onClick={() => onDeleteTask(t)} className="text-muted-foreground hover:text-rose-600 p-1" title="Remover">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>,
          )

          return (
            <div
              key={t.id}
              className={`grid border-b hover:bg-muted/20 transition-colors ${isSubtask ? 'bg-muted/10' : ''}`}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {cells}
            </div>
          )
        })}
      </div>
    </div>
  )
}
