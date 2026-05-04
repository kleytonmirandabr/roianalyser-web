/**
 * Tabela tipo Excel — componente principal (Phase 3 Sprint 3.6 → 4.1).
 *
 * Sprint 4.1 — novas features:
 *   - Busca global no toolbar (filtra pelo título em tempo real)
 *   - Seleção múltipla + ações em lote (alterar status / excluir)
 *   - Exportar CSV (com filtros e colunas visíveis aplicados)
 *   - Freeze da coluna "Tarefa" (sticky left no scroll horizontal)
 *   - Barra de progresso visual na coluna %
 *   - Persistência de filtros/sort/colunas ocultas no localStorage
 */
import {
  DndContext, DragOverlay, PointerSensor,
  closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  ArrowDown, ArrowUp, ArrowUpDown,
  CheckCircle2, ChevronDown, ChevronRight,
  Circle, Download, Eye, Filter, GripVertical,
  MessageSquare, Plus, Trash2, UserCircle2, X,
} from 'lucide-react'
import {
  useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'

import {
  MILESTONE_STATUS_COLORS, MILESTONE_STATUS_LABELS,
  type MilestoneKind, type MilestoneStatus, type ProjectMilestone,
} from '@/features/projects2/milestones-types'
import { ColumnCellEditor, ColumnCellReadonly } from '@/features/projects2/components/ColumnCellEditor'

import { ColumnActionsMenu }  from './ColumnActionsMenu'
import { TaskCommentPanel }   from '../TaskCommentPanel'
import { MultiPeoplePicker }  from './MultiPeoplePicker'
import { SelectPill, SelectPillEditor } from './SelectPill'
import { SortableRow }        from './SortableRow'
import {
  COL_ALIGN, COL_WIDTH, NON_HIDEABLE,
  fmtDate, initials, isFilterActive, matchColFilter, relativeTime,
} from './helpers'
import type {
  ColFilter, Column, FlatRow, InlineCreate, Row, TableSort, TasksTableViewProps,
} from './types'


/** Pill colorida para status nativo — clique abre mini-dropdown. */
function StatusPillPicker({ value, canEdit, options, onChange }: {
  value: MilestoneStatus
  canEdit: boolean
  options: { value: string; label: string }[]
  onChange: (v: MilestoneStatus) => void
}) {
  const [open, setOpen] = useState(false)
  if (!canEdit) {
    return (
      <span className={`text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 ${MILESTONE_STATUS_COLORS[value]}`}>
        {MILESTONE_STATUS_LABELS[value]}
      </span>
    )
  }
  return (
    <div className="relative inline-flex">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="hover:opacity-80 transition-opacity focus:outline-none">
        <span className={`text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 cursor-pointer ${MILESTONE_STATUS_COLORS[value]}`}>
          {MILESTONE_STATUS_LABELS[value]}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-50 mt-1 bg-popover border rounded-md shadow-lg py-1 min-w-[140px]">
            {options.map(s => (
              <button key={s.value} type="button"
                onClick={() => { onChange(s.value as MilestoneStatus); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 hover:bg-muted/50 flex items-center gap-2">
                <span className={`text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 ${MILESTONE_STATUS_COLORS[s.value as MilestoneStatus]}`}>
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function TasksTableView({
  items, customCols, valuesByTaskCol, users, canEdit,
  collapsed, onToggleCollapse, onUpdateTask, onDeleteTask,
  onCreateTask, onReorderGroup,
  onPutColumnValue, onOpenColumnsManager,
  onRenameColumn, onDeleteColumn,
  subtaskCount,
  createRequest, onCreateRequestConsumed,
}: TasksTableViewProps) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [sort, setSort]                     = useState<TableSort | null>(null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft]         = useState('')
  const titleInputRef                       = useRef<HTMLInputElement>(null)

  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null)
  const [inlineTitle, setInlineTitle]   = useState('')
  const [inlineSaving, setInlineSaving] = useState(false)
  const inlineInputRef                  = useRef<HTMLInputElement>(null)

  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [colFilters, setColFilters]   = useState<Record<string, ColFilter>>({})
  const [hiddenCols, setHiddenCols]   = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Column ordering ────────────────────────────────────────────────────────
  const [colOrder, setColOrder]     = useState<string[]>([])
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [overColKey, setOverColKey] = useState<string | null>(null)

  /** Colunas fixas que não participam do reorder */
  const REORDER_PINNED = useMemo(
    () => new Set(['select', 'drag', 'expand', 'check', 'title', 'addCol', 'rowActions']),
    []
  )

  const [editingProgressId, setEditingProgressId] = useState<string | null>(null)
  const [progressDraft, setProgressDraft]         = useState('')
  const progressInputRef = useRef<HTMLInputElement>(null)

  const [commentTaskId, setCommentTaskId] = useState<string | null>(null)

  // ── LocalStorage persistence ───────────────────────────────────────────────
  const storageKey = useMemo(() => {
    const match = typeof window !== 'undefined'
      ? window.location.pathname.match(/\/projects\/(\w+)/)
      : null
    return match ? `tasktable_${match[1]}` : null
  }, [])

  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (!saved) return
      const { colFilters: cf, hiddenCols: hc, sort: s, colOrder: co } = JSON.parse(saved)
      if (cf && typeof cf === 'object') setColFilters(cf)
      if (Array.isArray(hc)) setHiddenCols(new Set(hc))
      if (s) setSort(s)
      if (Array.isArray(co)) setColOrder(co)
    } catch { /* ignore corrupt data */ }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        colFilters, hiddenCols: [...hiddenCols], sort, colOrder,
      }))
    } catch { /* ignore quota errors */ }
  }, [colFilters, hiddenCols, sort, colOrder, storageKey])

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { if (editingTitleId) titleInputRef.current?.focus() }, [editingTitleId])
  useEffect(() => { if (inlineCreate) setTimeout(() => inlineInputRef.current?.focus(), 30) }, [inlineCreate])
  useEffect(() => {
    if (createRequest) {
      setInlineCreate({ kind: createRequest.kind, parentId: null, groupId: null })
      setInlineTitle('')
      onCreateRequestConsumed?.()
    }
  }, [createRequest])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function startEditTitle(t: ProjectMilestone) {
    if (!canEdit) return
    setEditingTitleId(t.id); setTitleDraft(t.title)
  }
  function commitTitle(taskId: string) {
    if (titleDraft.trim()) onUpdateTask(taskId, { title: titleDraft.trim() })
    setEditingTitleId(null)
  }
  function openInlineCreate(kind: MilestoneKind, parentId: string | null, groupId: string | null) {
    setInlineCreate({ kind, parentId, groupId }); setInlineTitle('')
  }
  async function commitInlineCreate(andContinue = false) {
    if (!inlineTitle.trim() || !inlineCreate || inlineSaving) return
    setInlineSaving(true)
    try {
      await onCreateTask(inlineCreate.kind, inlineCreate.parentId, inlineTitle.trim())
      setInlineTitle('')
      if (!andContinue) setInlineCreate(null)
      else inlineInputRef.current?.focus()
    } finally { setInlineSaving(false) }
  }
  function setFilter(key: string, f: ColFilter | null) {
    setColFilters(prev => {
      if (!f) { const n = { ...prev }; delete n[key]; return n }
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
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function handleColDrop(fromKey: string, toKey: string) {
    if (fromKey === toKey || REORDER_PINNED.has(fromKey) || REORDER_PINNED.has(toKey)) return
    setColOrder(prev => {
      const reorderable = visibleColumns.filter(c => !REORDER_PINNED.has(c.key)).map(c => c.key)
      const base = prev.length
        ? [...prev.filter(k => reorderable.includes(k)), ...reorderable.filter(k => !prev.includes(k))]
        : reorderable
      const from = base.indexOf(fromKey)
      const to   = base.indexOf(toKey)
      if (from < 0 || to < 0) return prev
      const next = [...base]
      next.splice(from, 1)
      next.splice(to, 0, fromKey)
      return next
    })
  }

  function bulkDelete() {
    selectedIds.forEach(id => {
      const task = items.find(i => i.id === id)
      if (task) onDeleteTask(task)
    })
    setSelectedIds(new Set())
  }
  function bulkChangeStatus(status: MilestoneStatus) {
    selectedIds.forEach(id => onUpdateTask(id, { status }))
    setSelectedIds(new Set())
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const dataCols = visibleColumns.filter(
      c => !['select', 'drag', 'expand', 'check', 'addCol', 'rowActions'].includes(c.key)
    )
    const header = dataCols.map(c => `"${c.label || c.key}"`).join(',')
    const rows = flatRows
      .filter((r): r is FlatRow => r._type === 'task' && r.level > 0)
      .map(({ task: t }) => dataCols.map(c => {
        let v = ''
        if      (c.key === 'title')       v = t.title
        else if (c.key === 'plannedDate') v = t.plannedDate || ''
        else if (c.key === 'status')      v = MILESTONE_STATUS_LABELS[t.status]
        else if (c.key === 'responsible') v = t.responsibleIds.map(id => users.find(u => u.id === id)?.name || id).join('; ')
        else if (c.key === 'progress')    v = String(t.progressPct ?? 0)
        else if (c.key === 'updatedAt')   v = t.updatedAt || ''
        else if (c.colId)                 v = String(valuesByTaskCol[t.id]?.[c.colId]?.value ?? '')
        return `"${v.replace(/"/g, '""')}"`
      }).join(','))
    const csv = '﻿' + [header, ...rows].join('\n')
    const a   = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: 'cronograma.csv',
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  // ── Tree ───────────────────────────────────────────────────────────────────
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
      if      (sort.key === 'title')       { av = a.title;             bv = b.title }
      else if (sort.key === 'plannedDate') { av = a.plannedDate || '￿'; bv = b.plannedDate || '￿' }
      else if (sort.key === 'status')      { av = a.status;             bv = b.status }
      else if (sort.key === 'progress')    { av = a.progressPct ?? 0;   bv = b.progressPct ?? 0 }
      else if (sort.key === 'updatedAt')   { av = a.updatedAt;          bv = b.updatedAt }
      else if (sort.key.startsWith('col_')) {
        const id = sort.key.slice(4)
        av = valuesByTaskCol[a.id]?.[id]?.value ?? ''
        bv = valuesByTaskCol[b.id]?.[id]?.value ?? ''
      }
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'pt-BR')
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return out
  }

  function taskMatchesFilters(t: ProjectMilestone): boolean {
    // Filtros de coluna
    for (const [key, f] of Object.entries(colFilters)) {
      if (!isFilterActive(f)) continue
      let match = true
      if      (key === 'title')        match = matchColFilter(t.title, f)
      else if (key === 'plannedDate')  match = matchColFilter(t.plannedDate?.slice(0, 10), f)
      else if (key === 'status')       match = matchColFilter(t.status, f)
      else if (key === 'responsible')  match = matchColFilter(t.responsibleIds, f)
      else if (key === 'progress')     match = matchColFilter(t.progressPct, f)
      else if (key === 'updatedAt')    match = matchColFilter(t.updatedAt?.slice(0, 10), f)
      else if (key.startsWith('col_')) match = matchColFilter(valuesByTaskCol[t.id]?.[key.slice(4)]?.value ?? null, f)
      if (!match) return false
    }
    return true
  }

  const hasActiveFilters = useMemo(
    () => Object.values(colFilters).some(f => isFilterActive(f)),
    [colFilters]
  )

  // ── Flat rows ──────────────────────────────────────────────────────────────
  const flatRows: Row[] = useMemo(() => {
    const out: Row[] = []

    sortArr(tree.rootTasks).forEach(t => {
      if (hasActiveFilters && !taskMatchesFilters(t)) return
      out.push({ _type: 'task', task: t, level: 1 })
      if (!collapsed.has(t.id))
        sortArr(tree.subtasksByParent[t.id] || []).forEach(s => {
          if (hasActiveFilters && !taskMatchesFilters(s)) return
          out.push({ _type: 'task', task: s, level: 2 })
        })
    })

    sortArr(tree.rootGroups).forEach(g => {
      out.push({ _type: 'task', task: g, level: 0 })
      if (!collapsed.has(g.id)) {
        const all     = sortArr(tree.tasksByParent[g.id] || [])
        const visible = hasActiveFilters ? all.filter(t => taskMatchesFilters(t)) : all
        visible.forEach(t => {
          out.push({ _type: 'task', task: t, level: 1, groupId: g.id })
          if (!collapsed.has(t.id))
            sortArr(tree.subtasksByParent[t.id] || []).forEach(s => {
              if (hasActiveFilters && !taskMatchesFilters(s)) return
              out.push({ _type: 'task', task: s, level: 2, groupId: g.id })
            })
        })
        if (visible.length > 0) {
          const done   = visible.filter(t => t.status === 'done').length
          const avgPct = Math.round(visible.reduce((a, t) => a + (t.progressPct || 0), 0) / visible.length)
          out.push({ _type: 'footer', groupId: g.id, total: visible.length, done, avgPct })
        }
        if (canEdit) out.push({ _type: 'add', groupId: g.id })
      }
    })

    if (canEdit) out.push({ _type: 'add-group' })
    if (canEdit) out.push({ _type: 'add', groupId: null })
    return out
  }, [tree, collapsed, sort, canEdit, colFilters, valuesByTaskCol])

  const idsByGroup = useMemo(() => {
    const map: Record<string, string[]> = { __root__: [] }
    tree.rootTasks.forEach(t => map['__root__'].push(t.id))
    tree.rootGroups.forEach(g => { map[g.id] = (tree.tasksByParent[g.id] || []).map(t => t.id) })
    return map
  }, [tree])

  // IDs selecionáveis (tasks + subtasks, excluindo grupos)
  const selectableIds = useMemo(
    () => flatRows.filter((r): r is FlatRow => r._type === 'task' && r.level > 0).map(r => r.task.id),
    [flatRows]
  )
  const allSelected  = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id))
  const someSelected = !allSelected && selectableIds.some(id => selectedIds.has(id))

  // ── Columns + grid ─────────────────────────────────────────────────────────
  const columns: Column[] = useMemo(() => {
    const base: Column[] = []
    if (canEdit) base.push({ key: 'select', label: '', width: '32px' })
    base.push(
      { key: 'drag',        label: '',            width: '28px' },
      { key: 'expand',      label: '',            width: '28px' },
      { key: 'check',       label: '',            width: '32px' },
      { key: 'title',       label: 'Tarefa',      width: 'minmax(260px, 1fr)', sortable: true },
      { key: 'plannedDate', label: 'Prazo',        width: '130px', sortable: true, align: 'center' },
      { key: 'status',      label: 'Status',       width: '150px', sortable: true },
      { key: 'responsible', label: 'Responsável',  width: '150px' },
      { key: 'progress',    label: '%',            width: '100px', sortable: true, align: 'center' },
    )
    customCols.forEach(c => base.push({
      key: `col_${c.id}`, label: c.label,
      width: COL_WIDTH[c.type] || '160px',
      sortable: true, colId: c.id, align: COL_ALIGN[c.type],
    }))
    base.push({ key: 'updatedAt',  label: 'Atualizado', width: '130px', sortable: true })
    base.push({ key: 'addCol',     label: '',           width: '36px' })
    base.push({ key: 'rowActions', label: '',           width: '52px' })
    return base
  }, [customCols, canEdit])

  const visibleColumns = useMemo(() => {
    const visible = columns.filter(c => !hiddenCols.has(c.key))
    if (colOrder.length === 0) return visible

    const pinnedLeft  = visible.filter(c => ['select','drag','expand','check','title'].includes(c.key))
    const reorderable = visible.filter(c => !REORDER_PINNED.has(c.key))
    const pinnedRight = visible.filter(c => ['addCol','rowActions'].includes(c.key))

    const ordered   = colOrder.filter(k => reorderable.some(c => c.key === k)).map(k => reorderable.find(c => c.key === k)!)
    const remaining = reorderable.filter(c => !colOrder.includes(c.key))

    return [...pinnedLeft, ...ordered, ...remaining, ...pinnedRight]
  }, [columns, hiddenCols, colOrder, REORDER_PINNED])
  const gridTemplate   = visibleColumns.map(c => c.width).join(' ')
  const vcLen          = visibleColumns.length

  // Índice (1-based) da coluna Tarefa — usado nos spans e no sticky
  const titleColIdx = visibleColumns.findIndex(c => c.key === 'title') + 1

  // Offset left para o sticky da coluna Tarefa
  const titleStickyLeft = useMemo(() => {
    let total = 0
    for (const c of visibleColumns) {
      if (c.key === 'title') break
      const w = parseInt(c.width)
      if (!isNaN(w)) total += w
    }
    return total
  }, [visibleColumns])

  // ── Helpers de render ──────────────────────────────────────────────────────
  const statusOptions = (Object.entries(MILESTONE_STATUS_LABELS) as Array<[MilestoneStatus, string]>)
    .map(([value, label]) => ({ value, label }))

  function SortIcon({ sortKey }: { sortKey: string }) {
    if (!sort || sort.key !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-0.5 shrink-0" />
    return sort.dir === 'asc'
      ? <ArrowUp   className="h-3 w-3 text-primary ml-0.5 shrink-0" />
      : <ArrowDown className="h-3 w-3 text-primary ml-0.5 shrink-0" />
  }

  // ─── Barra de progresso visual ────────────────────────────────────────────
  function ProgressBar({ pct }: { pct: number }) {
    const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b'
    return (
      <div className="flex items-center gap-1.5 w-full">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-0">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-[10px] tabular-nums shrink-0 w-7 text-right">{pct}%</span>
      </div>
    )
  }

  function HeaderCell({ col }: { col: Column }) {
    if (col.key === 'addCol') return (
      <button type="button" onClick={onOpenColumnsManager}
        className="flex items-center justify-center text-muted-foreground hover:text-primary border-l hover:bg-muted/50 transition-colors"
        title="Adicionar coluna"><Plus className="h-3.5 w-3.5" /></button>
    )
    if (['drag', 'expand', 'check', 'rowActions'].includes(col.key))
      return <div className="border-l first:border-l-0" />

    if (col.key === 'select') return (
      <div className="border-l first:border-l-0 flex items-center justify-center">
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = someSelected }}
          onChange={e => setSelectedIds(e.target.checked ? new Set(selectableIds) : new Set())}
          className="h-3.5 w-3.5 cursor-pointer"
        />
      </div>
    )

    const isTitle   = col.key === 'title'
    const customCol = col.colId ? customCols.find(c => c.id === col.colId) : undefined
    const colFilter = colFilters[col.key]
    const isFiltered = colFilter ? isFilterActive(colFilter) : false

    const isDraggable = !REORDER_PINNED.has(col.key)
    const isDropTarget = overColKey === col.key && dragColKey !== col.key && isDraggable

    return (
      <div
        onClick={col.sortable ? () => toggleSort(col.key) : undefined}
        style={{
          ...(isTitle ? { position: 'sticky', left: titleStickyLeft, zIndex: 11 } : {}),
          ...(isDropTarget ? { borderLeft: '2px solid hsl(var(--primary))' } : {}),
        }}
        className={`px-2 py-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground border-l flex items-center gap-1 select-none overflow-hidden bg-muted/40 ${col.sortable ? 'cursor-pointer hover:bg-muted/60' : ''} ${col.align === 'center' ? 'justify-center' : ''} ${dragColKey === col.key ? 'opacity-40' : ''}`}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragColKey(col.key) } : undefined}
        onDragOver={isDraggable ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverColKey(col.key) } : undefined}
        onDrop={isDraggable ? (e) => { e.preventDefault(); if (dragColKey) handleColDrop(dragColKey, col.key); setDragColKey(null); setOverColKey(null) } : undefined}
        onDragEnd={() => { setDragColKey(null); setOverColKey(null) }}
        onDragLeave={() => { if (overColKey === col.key) setOverColKey(null) }}
      >
        {isDraggable && (
          <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/40 hover:text-muted-foreground cursor-grab" />
        )}
        {isFiltered && <Filter className="h-3 w-3 text-primary shrink-0" />}
        <span className="truncate min-w-0" title={col.label}>{col.label}</span>
        {col.sortable && <SortIcon sortKey={col.key} />}
        <ColumnActionsMenu
          col={col} customCol={customCol}
          sort={sort}
          onSort={(dir) => setSort({ key: col.key, dir })}
          onClearSort={() => setSort(null)}
          colFilter={colFilter}
          onFilter={(f) => setFilter(col.key, f)}
          canHide={!NON_HIDEABLE.has(col.key)}
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

  // ⚠️ Função render (não componente) para evitar unmount/remount a cada re-render
  function renderInlineCreateRow(groupId: string | null, groupRow = false) {
    if (!inlineCreate || inlineCreate.groupId !== groupId) return null
    if (groupRow  && inlineCreate.kind !== 'group') return null
    if (!groupRow && inlineCreate.kind === 'group') return null
    const label = inlineCreate.kind === 'group' ? 'grupo' : inlineCreate.kind === 'task' ? 'tarefa' : 'subtarefa'
    return (
      <div className="grid border-b bg-primary/3" style={{ gridTemplateColumns: gridTemplate }}>
        {canEdit && <div />}
        <div /><div /><div />
        <div className="px-2 py-1.5 flex items-center gap-2" style={{ gridColumn: `${titleColIdx} / ${vcLen - 1}` }}>
          <input ref={inlineInputRef} value={inlineTitle} onChange={e => setInlineTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitInlineCreate(true)
              if (e.key === 'Escape') { setInlineCreate(null); setInlineTitle('') }
            }}
            placeholder={`Nome do ${label}… (Enter salva, Esc cancela)`}
            disabled={inlineSaving}
            className="flex-1 h-7 px-2 text-sm rounded border border-primary bg-background focus:outline-none"
          />
          <button type="button" onClick={() => commitInlineCreate(false)} disabled={!inlineTitle.trim() || inlineSaving}
            className="h-7 px-3 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50 shrink-0">
            {inlineSaving ? '…' : 'Salvar'}
          </button>
          <button type="button" onClick={() => { setInlineCreate(null); setInlineTitle('') }}
            className="h-7 px-2 text-xs rounded border text-muted-foreground hover:bg-muted shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // ── DnD ────────────────────────────────────────────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const aid = String(active.id), oid = String(over.id)
    for (const [gid, ids] of Object.entries(idsByGroup)) {
      if (ids.includes(aid) && ids.includes(oid)) {
        onReorderGroup(gid === '__root__' ? null : gid, arrayMove(ids, ids.indexOf(aid), ids.indexOf(oid)))
        return
      }
    }
  }

  const activeTask = activeId ? items.find(i => i.id === activeId) : null

  // ── Contagem de tarefas visíveis (para o toolbar) ──────────────────────────
  const visibleTaskCount = flatRows.filter(r => r._type === 'task' && (r as FlatRow).level > 0).length
  const totalTaskCount   = items.filter(i => i.kind !== 'group').length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={e => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <>
        {/* ── Toolbar: contador + exportar ── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
          {hasActiveFilters && visibleTaskCount !== totalTaskCount && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {visibleTaskCount} de {totalTaskCount} tarefas
            </span>
          )}
          <button type="button" onClick={exportCSV} title="Exportar CSV"
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2.5 h-8 transition-colors hover:bg-muted/50">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {/* ── Bulk actions bar ── */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 border-b text-xs">
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              {selectedIds.size} {selectedIds.size === 1 ? 'selecionada' : 'selecionadas'}
            </span>
            <span className="text-muted-foreground">Alterar status:</span>
            <div className="flex items-center gap-1">
              {statusOptions.map(s => (
                <button key={s.value} type="button"
                  onClick={() => bulkChangeStatus(s.value as MilestoneStatus)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-opacity hover:opacity-80 ${MILESTONE_STATUS_COLORS[s.value as MilestoneStatus]}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={bulkDelete}
              className="flex items-center gap-1 text-rose-600 hover:underline ml-2">
              <Trash2 className="h-3 w-3" /> Excluir
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Desmarcar
            </button>
          </div>
        )}

        {/* ── Filtros ativos / colunas ocultas ── */}
        {(hasActiveFilters || hiddenCols.size > 0) && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-primary/5 border-b text-xs text-muted-foreground">
            {Object.values(colFilters).some(f => isFilterActive(f)) && (
              <button type="button"
                onClick={() => { setColFilters({}) }}
                className="flex items-center gap-1.5 text-primary hover:underline">
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
            {hiddenCols.size > 0 && (
              <button type="button" onClick={() => setHiddenCols(new Set())}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Eye className="h-3 w-3" />
                Restaurar {hiddenCols.size} coluna{hiddenCols.size !== 1 ? 's' : ''} oculta{hiddenCols.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto border-t">
          <div className="min-w-max">
            {/* Header */}
            <div className="grid sticky top-0 bg-muted/40 border-b z-10" style={{ gridTemplateColumns: gridTemplate }}>
              {visibleColumns.map(c => <HeaderCell key={c.key} col={c} />)}
            </div>

            {/* Rows */}
            {flatRows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground italic text-center">
                {hasActiveFilters
                  ? 'Nenhuma tarefa corresponde aos filtros.'
                  : `Nenhuma tarefa.${canEdit ? ' Use os botões acima.' : ''}`}
              </div>
            ) : (() => {
              const elements: ReactNode[] = []

              for (let ri = 0; ri < flatRows.length; ri++) {
                const r = flatRows[ri]

                if (r._type === 'add-group') {
                  elements.push(
                    <div key="add-group">
                      {renderInlineCreateRow(null, true)}
                      {(!inlineCreate || inlineCreate.kind !== 'group') && (
                        <div className="grid border-b" style={{ gridTemplateColumns: gridTemplate }}>
                          {canEdit && <div />}<div /><div /><div />
                          <div className="px-2 py-1.5" style={{ gridColumn: `${titleColIdx} / ${vcLen + 1}` }}>
                            <button type="button" onClick={() => openInlineCreate('group', null, null)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5">
                              <Plus className="h-3.5 w-3.5" /><span className="font-medium">Novo grupo</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ); continue
                }

                if (r._type === 'footer') {
                  elements.push(
                    <div key={`footer_${r.groupId}`} className="grid border-b bg-muted/10" style={{ gridTemplateColumns: gridTemplate }}>
                      {canEdit && <div />}<div /><div /><div />
                      <div className="px-2 py-1 text-[11px] text-muted-foreground flex items-center gap-3" style={{ gridColumn: `${titleColIdx} / ${vcLen + 1}` }}>
                        <span className={`font-semibold ${r.done === r.total && r.total > 0 ? 'text-emerald-600' : ''}`}>{r.done}/{r.total} concluídas</span>
                        <span>·</span><span>{r.avgPct}% médio</span>
                        {r.done === r.total && r.total > 0 && <span className="text-emerald-600 font-semibold">✓ Grupo completo</span>}
                      </div>
                    </div>
                  ); continue
                }

                if (r._type === 'add') {
                  const gid = r.groupId
                  elements.push(
                    <div key={`add_${gid ?? 'root'}_${ri}`}>
                      {renderInlineCreateRow(gid)}
                      {(!inlineCreate || inlineCreate.groupId !== gid) && (
                        <div className="grid border-b" style={{ gridTemplateColumns: gridTemplate }}>
                          {canEdit && <div />}<div /><div /><div />
                          <div className="px-2 py-1" style={{ gridColumn: `${titleColIdx} / ${vcLen + 1}` }}>
                            <button type="button" onClick={() => openInlineCreate('task', gid, gid)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors w-full py-0.5">
                              <Plus className="h-3.5 w-3.5" /><span>Adicionar tarefa</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ); continue
                }

                const { task: t, level, groupId: taskGroupId } = r

                if (level === 0) {
                  const childCount = (tree.tasksByParent[t.id] || []).length
                  elements.push(
                    <div key={t.id} className="grid bg-primary/5 border-b font-semibold" style={{ gridTemplateColumns: gridTemplate }}>
                      {canEdit && <div />}
                      <div />
                      <button onClick={() => onToggleCollapse(t.id)} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
                        {collapsed.has(t.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      <div />
                      <div className="px-2 py-1.5 text-sm flex items-center gap-2 overflow-hidden" style={{ gridColumn: `${titleColIdx} / ${vcLen + 1}` }}>
                        <span className="truncate">{t.title}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground font-normal">{childCount} tarefa{childCount !== 1 ? 's' : ''}</span>
                        <span className={`text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 ${MILESTONE_STATUS_COLORS[t.status]}`}>{MILESTONE_STATUS_LABELS[t.status]}</span>
                        {canEdit && (
                          <span className="ml-auto flex items-center gap-1">
                            <button type="button" onClick={() => openInlineCreate('task', t.id, t.id)} className="text-muted-foreground hover:text-primary" title="Adicionar tarefa"><Plus className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => onDeleteTask(t)} className="text-muted-foreground hover:text-rose-600" title="Remover grupo"><Trash2 className="h-3.5 w-3.5" /></button>
                          </span>
                        )}
                      </div>
                    </div>
                  ); continue
                }

                // Task / subtask row
                const isSubtask      = level === 2
                const hasChildren    = !isSubtask && (tree.subtasksByParent[t.id]?.length || 0) > 0
                const isEditingTitle = editingTitleId === t.id
                const isDraggable    = canEdit && !isSubtask && !sort
                const isSelected     = selectedIds.has(t.id)

                const rowContent = (drag: ReactNode) => {
                  const cellMap: Record<string, ReactNode> = {}

                  if (canEdit) {
                    cellMap['select'] = (
                      <div key="select" className="border-l first:border-l-0 flex items-center justify-center">
                        <input type="checkbox" checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                          onClick={e => e.stopPropagation()}
                          className="h-3.5 w-3.5 cursor-pointer" />
                      </div>
                    )
                  }

                  cellMap['drag']   = <div key="drag" className="border-l first:border-l-0">{drag}</div>
                  cellMap['expand'] = (
                    <div key="expand" className="flex items-center justify-center border-l">
                      {hasChildren && (
                        <button onClick={() => onToggleCollapse(t.id)} className="text-muted-foreground hover:text-foreground">
                          {collapsed.has(t.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                    <div key="title"
                      style={{ position: 'sticky', left: titleStickyLeft, zIndex: 5 }}
                      className={`px-2 py-1.5 text-sm flex items-center gap-1.5 border-l overflow-hidden ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : isSubtask ? 'bg-muted/10' : 'bg-background'}`}>
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
                        <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold shrink-0">{subtaskCount[t.id]}</span>
                      )}
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setCommentTaskId(t.id) }}
                        title="Comentários"
                        className="ml-auto shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-primary hover:bg-muted/60 transition-colors opacity-0 group-hover/row:opacity-100">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                  cellMap['plannedDate'] = (
                    <div key="plannedDate" className="px-1 py-1 border-l flex items-center justify-center">
                      {canEdit
                        ? <input type="date" value={t.plannedDate || ''}
                            onChange={e => onUpdateTask(t.id, { plannedDate: e.target.value || null })}
                            className="w-full h-7 px-1 text-xs rounded border-0 bg-transparent hover:bg-muted/40 focus:bg-background focus:border focus:outline-none text-center" />
                        : <span className="text-xs text-muted-foreground tabular-nums">{fmtDate(t.plannedDate)}</span>
                      }
                    </div>
                  )
                  cellMap['status'] = (
                    <div key="status" className="px-1 py-1 border-l flex items-center justify-center">
                      <StatusPillPicker
                        value={t.status}
                        canEdit={canEdit}
                        options={statusOptions}
                        onChange={v => onUpdateTask(t.id, { status: v, completedDate: v !== 'done' ? null : undefined })}
                      />
                    </div>
                  )
                  cellMap['responsible'] = (
                    <div key="responsible" className="px-1.5 py-1 border-l flex items-center">
                      <MultiPeoplePicker value={t.responsibleIds} users={users}
                        onChange={ids => onUpdateTask(t.id, { responsibleIds: ids })} disabled={!canEdit} />
                    </div>
                  )
                  cellMap['progress'] = (
                    <div key="progress" className="px-2 py-1 border-l flex items-center"
                      onClick={() => {
                        if (!canEdit) return
                        setEditingProgressId(t.id)
                        setProgressDraft(String(t.progressPct ?? 0))
                        setTimeout(() => progressInputRef.current?.select(), 0)
                      }}>
                      {canEdit && editingProgressId === t.id ? (
                        <input
                          ref={progressInputRef}
                          type="number" min={0} max={100}
                          value={progressDraft}
                          onChange={e => setProgressDraft(e.target.value)}
                          onBlur={() => {
                            const v = Math.max(0, Math.min(100, Number(progressDraft) || 0))
                            onUpdateTask(t.id, { progressPct: v })
                            setEditingProgressId(null)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.currentTarget.blur() }
                            if (e.key === 'Escape') { setEditingProgressId(null) }
                          }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          className="w-14 h-7 px-1 text-xs rounded border bg-background tabular-nums text-center" />
                      ) : (
                        <ProgressBar pct={t.progressPct ?? 0} />
                      )}
                    </div>
                  )
                  customCols.forEach(c => {
                    const val = valuesByTaskCol[t.id]?.[c.id]?.value ?? null
                    const alignCls = COL_ALIGN[c.type] === 'center' ? 'justify-center' : COL_ALIGN[c.type] === 'right' ? 'justify-end' : ''
                    cellMap[`col_${c.id}`] = (
                      <div key={`col_${c.id}`} className={`px-1.5 py-1 border-l flex items-center overflow-hidden ${alignCls}`}>
                        {(c.type === 'select' || c.type === 'status')
                          ? (canEdit
                              ? <SelectPillEditor column={c} value={val} onChange={v => onPutColumnValue(t.id, c.id, v)} />
                              : <SelectPill column={c} value={val} />)
                          : canEdit
                            ? <ColumnCellEditor column={c} value={val} onChange={v => onPutColumnValue(t.id, c.id, v)} />
                            : <ColumnCellReadonly column={c} value={val} />
                        }
                      </div>
                    )
                  })
                  cellMap['updatedAt'] = (
                    <div key="updatedAt" className="px-2 py-1 border-l flex items-center gap-1.5 text-[11px] text-muted-foreground"
                      title={t.updatedAt ? new Date(t.updatedAt).toLocaleString('pt-BR') : ''}>
                      {t.responsibleIds[0]
                        ? <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
                            {initials(users.find(u => u.id === t.responsibleIds[0])?.name || '?')}
                          </div>
                        : <UserCircle2 className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                      <span className="truncate">{relativeTime(t.updatedAt)}</span>
                    </div>
                  )
                  cellMap['addCol']     = <div key="addCol" className="border-l" />
                  cellMap['rowActions'] = (
                    <div key="actions" className="border-l flex items-center justify-center gap-0.5">
                      {canEdit && !isSubtask && (
                        <button type="button" onClick={() => openInlineCreate('subtask', t.id, taskGroupId ?? null)}
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

                  return (
                    <div
                      className={`grid border-b transition-colors group/row ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : isSubtask ? 'bg-muted/10 hover:bg-muted/20' : 'hover:bg-muted/20'}`}
                      style={{ gridTemplateColumns: gridTemplate }}>
                      {visibleColumns.map(c => cellMap[c.key])}
                    </div>
                  )
                }

                if (isDraggable) {
                  elements.push(<SortableRow key={t.id} id={t.id}>{drag => rowContent(drag)}</SortableRow>)
                } else {
                  elements.push(<div key={t.id}>{rowContent(<div />)}</div>)
                }
              }
              return elements
            })()}
          </div>
        </div>
      </>

      {/* ── Comment Panel ── */}
      {commentTaskId && (() => {
        const ct = items.find(i => i.id === commentTaskId)
        return ct ? (
          <TaskCommentPanel
            task={ct}
            canEdit={canEdit}
            onClose={() => setCommentTaskId(null)}
          />
        ) : null
      })()}

      <DragOverlay>
        {activeTask && (
          <div className="grid border rounded shadow-lg bg-background opacity-95 text-sm px-4 py-2"
            style={{ gridTemplateColumns: '28px 28px 32px 1fr', minWidth: 320 }}>
            <GripVertical className="h-4 w-4 text-muted-foreground" /><div />
            <Circle className="h-4 w-4 text-muted-foreground" />
            <span className="px-2 truncate">{activeTask.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
