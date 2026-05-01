/**
 * Tabela tipo Excel (Phase 3 Sprint 3.6) para o Cronograma do projeto.
 *
 * CSS Grid com headers sticky + larguras fixas. Click no header pra ordenar
 * (asc/desc/none), botao + no fim pra adicionar coluna, hierarquia preservada
 * (group / task / subtask), footer agregado por grupo.
 *
 * Substitui o "renderTaskRow + map" do ProjectTasksCard quando view==='list'.
 */
import {
  ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, ChevronDown, ChevronRight,
  Circle, Plus, Trash2, UserCircle2,
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

interface Props {
  items: ProjectMilestone[]                     // tarefas filtradas (ja ordenadas, mas vamos re-sort)
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
  onPutColumnValue: (taskId: string, colId: string, value: any) => void
  onOpenColumnsManager: () => void
  subtaskCount: Record<string, number>
}

interface Column {
  key: string
  label: string
  width: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
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

interface FlatRow {
  task: ProjectMilestone
  level: 0 | 1 | 2  // 0=group, 1=task, 2=subtask
  groupId?: string  // pra footer agregar
  isLastInGroup?: boolean
}

export function TasksTableView({
  items, customCols, valuesByTaskCol, users, canEdit,
  collapsed, onToggleCollapse, onUpdateTask, onDeleteTask,
  onAddTaskInGroup, onAddSubtaskInTask, onPutColumnValue,
  onOpenColumnsManager, subtaskCount,
}: Props) {
  const [sort, setSort] = useState<TableSort | null>(null)

  // Construir arvore: grupos -> tarefas -> subtarefas
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

  // Aplicar sort
  function sortTasks(arr: ProjectMilestone[]): ProjectMilestone[] {
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

  // Flat rows respeitando collapsed
  const flatRows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = []
    // Tarefas root (sem grupo)
    sortTasks(tree.rootTasks).forEach((t) => {
      out.push({ task: t, level: 1 })
      if (!collapsed.has(t.id)) {
        sortTasks(tree.subtasksByParent[t.id] || []).forEach((s) => out.push({ task: s, level: 2 }))
      }
    })
    // Grupos
    tree.rootGroups.forEach((g) => {
      out.push({ task: g, level: 0 })
      if (!collapsed.has(g.id)) {
        const childTasks = sortTasks(tree.tasksByParent[g.id] || [])
        childTasks.forEach((t, idx) => {
          out.push({
            task: t, level: 1, groupId: g.id,
            isLastInGroup: idx === childTasks.length - 1 && !(tree.subtasksByParent[t.id]?.length && !collapsed.has(t.id)),
          })
          if (!collapsed.has(t.id)) {
            const subs = sortTasks(tree.subtasksByParent[t.id] || [])
            subs.forEach((s, sidx) => {
              out.push({
                task: s, level: 2, groupId: g.id,
                isLastInGroup: idx === childTasks.length - 1 && sidx === subs.length - 1,
              })
            })
          }
        })
      }
    })
    return out
  }, [tree, collapsed, sort, valuesByTaskCol])

  // Construir colunas
  const columns: Column[] = useMemo(() => {
    const base: Column[] = [
      { key: 'expand', label: '', width: '28px' },
      { key: 'check', label: '', width: '32px' },
      { key: 'title', label: 'Tarefa', width: 'minmax(260px, 1fr)', sortable: true },
      { key: 'plannedDate', label: 'Prazo', width: '96px', sortable: true },
      { key: 'status', label: 'Status', width: '140px', sortable: true },
      { key: 'responsible', label: 'Responsavel', width: '144px' },
      { key: 'progress', label: '%', width: '80px', sortable: true, align: 'center' },
    ]
    customCols.forEach((c) => {
      base.push({ key: `col_${c.id}`, label: c.label, width: '160px', sortable: true })
    })
    base.push({ key: 'updatedAt', label: 'Atualizado', width: '100px', sortable: true })
    base.push({ key: 'addCol', label: '', width: '36px' })
    base.push({ key: 'rowActions', label: '', width: '52px' })
    return base
  }, [customCols])

  const gridTemplate = columns.map(c => c.width).join(' ')

  function toggleSort(key: string) {
    setSort((curr) => {
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
    return (
      <div
        role={col.sortable ? 'button' : undefined}
        onClick={col.sortable ? () => toggleSort(col.key) : undefined}
        className={`px-2 py-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground border-l flex items-center gap-1 select-none ${col.sortable ? 'cursor-pointer hover:bg-muted/50' : ''} ${col.align === 'center' ? 'justify-center' : ''}`}
        title={col.sortable ? 'Ordenar' : ''}
      >
        <span className="truncate">{col.label}</span>
        {col.sortable && <SortIcon sortKey={col.key} />}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border-t">
      <div className="min-w-max">
        {/* HEADER */}
        <div className="grid sticky top-0 bg-muted/40 border-b z-10" style={{ gridTemplateColumns: gridTemplate }}>
          {columns.map((c) => (<HeaderCell key={c.key} col={c} />))}
        </div>

        {/* ROWS */}
        {flatRows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground italic text-center">
            Nenhuma tarefa. {canEdit && 'Crie um grupo ou tarefa para começar.'}
          </div>
        ) : (
          flatRows.map((r) => {
            const t = r.task
            // GROUP row
            if (r.level === 0) {
              const isCollapsed = collapsed.has(t.id)
              const childCount = (tree.tasksByParent[t.id] || []).length
              return (
                <div
                  key={t.id}
                  className="grid bg-primary/5 border-b font-semibold"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <button onClick={() => onToggleCollapse(t.id)} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  <div />
                  <div
                    className="px-2 py-1.5 text-sm flex items-center gap-2 col-span-full"
                    style={{ gridColumn: `3 / ${columns.length + 1}` }}
                  >
                    <span className="truncate">{t.title}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground font-normal">{childCount} tarefa{childCount !== 1 ? 's' : ''}</span>
                    <span className={`text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 ${MILESTONE_STATUS_COLORS[t.status]}`}>
                      {MILESTONE_STATUS_LABELS[t.status]}
                    </span>
                    {canEdit && (
                      <span className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onAddTaskInGroup(t.id)}
                          className="text-muted-foreground hover:text-primary"
                          title="Tarefa neste grupo"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTask(t)}
                          className="text-muted-foreground hover:text-rose-600"
                          title="Remover grupo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )
            }

            // TASK / SUBTASK row
            const isSubtask = r.level === 2
            const hasChildren = !isSubtask && (tree.subtasksByParent[t.id]?.length || 0) > 0
            const isCollapsed = collapsed.has(t.id)
            const cells: ReactNode[] = []

            // 1) expand
            cells.push(
              <div key="expand" className="flex items-center justify-center">
                {hasChildren && (
                  <button onClick={() => onToggleCollapse(t.id)} className="text-muted-foreground hover:text-foreground">
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>,
            )

            // 2) check (toggle status done)
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

            // 3) title (com indent visual pra subtask)
            cells.push(
              <div key="title" className="px-2 py-1.5 text-sm flex items-center gap-1.5 border-l overflow-hidden">
                {isSubtask && <span className="ml-3 text-muted-foreground text-xs">↳</span>}
                <span className={`truncate ${t.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{t.title}</span>
                {!isSubtask && subtaskCount[t.id] && (
                  <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold flex-shrink-0">
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
            const statusOptions = (Object.entries(MILESTONE_STATUS_LABELS) as Array<[MilestoneStatus, string]>)
              .map(([value, label]) => ({ value, label }))
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
                    min={0}
                    max={100}
                    value={t.progressPct ?? ''}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                      onUpdateTask(t.id, { progressPct: v })
                    }}
                    className="w-14 h-7 px-1 text-xs rounded border bg-background tabular-nums text-center"
                  />
                ) : (
                  <span className="text-xs tabular-nums">{t.progressPct ?? 0}%</span>
                )}
              </div>,
            )

            // 8) custom cols
            customCols.forEach((c) => {
              const value = valuesByTaskCol[t.id]?.[c.id]?.value ?? null
              cells.push(
                <div key={`col_${c.id}`} className="px-1.5 py-1 border-l flex items-center overflow-hidden">
                  {canEdit
                    ? <ColumnCellEditor column={c} value={value} onChange={(v) => onPutColumnValue(t.id, c.id, v)} />
                    : <ColumnCellReadonly column={c} value={value} />}
                </div>,
              )
            })

            // 9) updatedAt
            cells.push(
              <div key="updatedAt" className="px-2 py-1 border-l flex items-center gap-1.5 text-[11px] text-muted-foreground" title={t.updatedAt ? new Date(t.updatedAt).toLocaleString('pt-BR') : ''}>
                {t.responsibleIds[0] ? (
                  <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-semibold flex-shrink-0">
                    {initials(users.find(u => u.id === t.responsibleIds[0])?.name || '?')}
                  </div>
                ) : (
                  <UserCircle2 className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className="truncate">{relativeTime(t.updatedAt)}</span>
              </div>,
            )

            // 10) addCol (vazio nas linhas, só preenche o slot)
            cells.push(<div key="addCol" className="border-l" />)

            // 11) row actions (subtask + delete)
            cells.push(
              <div key="actions" className="border-l flex items-center justify-center gap-0.5">
                {canEdit && !isSubtask && (
                  <button
                    type="button"
                    onClick={() => onAddSubtaskInTask(t.id)}
                    className="text-muted-foreground hover:text-primary p-1"
                    title="Subtarefa"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onDeleteTask(t)}
                    className="text-muted-foreground hover:text-rose-600 p-1"
                    title="Remover"
                  >
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
          })
        )}
      </div>
    </div>
  )
}
