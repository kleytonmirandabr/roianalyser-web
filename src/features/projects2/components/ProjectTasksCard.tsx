/**
 * Tarefas do projeto (Phase 1 P.2 — Monday-like).
 *
 * Hierarquia em 3 níveis:
 *   group (cabeçalho colorido)
 *     └ task (linha principal)
 *         └ subtask (linha indentada)
 *
 * Cada item: título, status (5 estados), datas, multi-responsáveis (avatares),
 * progresso %. Owner/Editor podem mexer; Viewer só visualiza.
 */
import {
  CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Circle, FolderTree, LayoutGrid, List, Plus, Settings2, Trash2, UserCircle2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import {
  MILESTONE_STATUS_COLORS,
  MILESTONE_STATUS_LABELS,
  type MilestoneKind,
  type MilestoneStatus,
  type ProjectMilestone,
} from '@/features/projects2/milestones-types'
import {
  useCreateMilestone,
  useDeleteMilestone,
  useProjectMilestones,
  useUpdateMilestone,
} from '@/features/projects2/hooks/use-project-milestones'
import {
  useColumnValues,
  useProjectTaskColumns,
  usePutColumnValue,
} from '@/features/projects2/hooks/use-project-task-columns'
import type { ProjectTaskColumn, TaskColumnValue } from '@/features/projects2/task-columns-types'
import { ColumnsManager } from '@/features/projects2/components/ColumnsManager'
import { ColumnCellEditor, ColumnCellReadonly } from '@/features/projects2/components/ColumnCellEditor'
import { TasksKanbanView } from '@/features/projects2/components/TasksKanbanView'
import { TasksCalendarView } from '@/features/projects2/components/TasksCalendarView'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'

interface Props {
  projectId: string | undefined
  canEdit: boolean
}

interface UserMini { id: string; name: string; email: string }

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch { return iso }
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

/* MultiPeoplePicker — popover simples com checkboxes pra escolher N usuários. */
function MultiPeoplePicker({
  value, users, onChange, disabled,
}: { value: string[]; users: UserMini[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
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

  const filtered = users.filter(u =>
    !search.trim() || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
  )

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter(x => x !== id))
    else onChange([...value, id])
  }

  const selected = users.filter(u => value.includes(u.id))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1 px-2 py-1 text-xs rounded border bg-background hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">Atribuir...</span>
        ) : (
          <span className="truncate">
            {selected.length === 1 ? selected[0].name : `${selected.length} pessoas`}
          </span>
        )}
        <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 max-h-72 overflow-auto rounded-md border bg-popover shadow-md">
          <div className="p-1.5 border-b">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-7 text-xs"
            />
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
                    onClick={() => toggle(u.id)}
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

function ResponsibleAvatars({ ids, users, max = 3 }: { ids: string[]; users: UserMini[]; max?: number }) {
  const list = ids.map(id => users.find(u => u.id === id)).filter(Boolean) as UserMini[]
  if (list.length === 0) {
    return <UserCircle2 className="h-6 w-6 text-muted-foreground/40" />
  }
  const visible = list.slice(0, max)
  const extra = list.length - visible.length
  return (
    <div className="flex -space-x-1.5">
      {visible.map(u => (
        <div
          key={u.id}
          title={u.name}
          className="h-6 w-6 rounded-full ring-2 ring-background bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold"
        >
          {initials(u.name)}
        </div>
      ))}
      {extra > 0 && (
        <div className="h-6 w-6 rounded-full ring-2 ring-background bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-semibold">
          +{extra}
        </div>
      )}
    </div>
  )
}

export function ProjectTasksCard({ projectId, canEdit }: Props) {
  const list = useProjectMilestones(projectId)
  const create = useCreateMilestone(projectId)
  const update = useUpdateMilestone(projectId)
  const remove = useDeleteMilestone(projectId)
  const colsList = useProjectTaskColumns(projectId)
  const customCols: ProjectTaskColumn[] = colsList.data || []
  const putValue = usePutColumnValue(projectId)
  const [colsModalOpen, setColsModalOpen] = useState(false)
  const appState = useAppState()
  const users: UserMini[] = ((appState.data?.users || []) as Array<{ id: string; name?: string; email?: string }>)
    .map(u => ({ id: String(u.id), name: u.name || u.email || `User #${u.id}`, email: u.email || '' }))

  const items = list.data || []

  const tree = useMemo(() => {
    const rootGroups = items.filter(i => i.kind === 'group' && !i.parentId)
    const rootTasks = items.filter(i => i.kind === 'task' && !i.parentId)
    const tasksByParent: Record<string, ProjectMilestone[]> = {}
    const subtasksByParent: Record<string, ProjectMilestone[]> = {}
    items.forEach(i => {
      if (i.parentId && i.kind === 'task') {
        (tasksByParent[i.parentId] = tasksByParent[i.parentId] || []).push(i)
      } else if (i.parentId && i.kind === 'subtask') {
        (subtasksByParent[i.parentId] = subtasksByParent[i.parentId] || []).push(i)
      }
    })
    return { rootGroups, rootTasks, tasksByParent, subtasksByParent }
  }, [items])

  const allTaskIds = useMemo(() => items.map((i) => i.id), [items])
  const valuesQuery = useColumnValues(projectId, allTaskIds)
  const valuesByTaskCol = useMemo(() => {
    const map: Record<string, Record<string, TaskColumnValue>> = {}
    for (const v of valuesQuery.data || []) {
      ;(map[v.taskId] = map[v.taskId] || {})[v.columnId] = v
    }
    return map
  }, [valuesQuery.data])

  function getValue(taskId: string, colId: string): any {
    return valuesByTaskCol[taskId]?.[colId]?.value ?? null
  }

  function setValue(taskId: string, colId: string, value: any) {
    putValue.mutate({ taskId, columnId: colId, value })
  }

  const total = items.length
  const done = items.filter(i => i.status === 'done').length

  const [adding, setAdding] = useState<{ kind: MilestoneKind; parentId: string | null } | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list')
  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleAdd() {
    if (!projectId || !newTitle.trim() || !adding) return
    try {
      await create.mutateAsync({
        title: newTitle.trim(),
        plannedDate: newDate || null,
        status: 'planning',
        kind: adding.kind,
        parentId: adding.parentId,
      })
      toastSaved(`${adding.kind === 'group' ? 'Grupo' : adding.kind === 'task' ? 'Tarefa' : 'Subtarefa'} criada`)
      setNewTitle(''); setNewDate(''); setAdding(null)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleStatusChange(m: ProjectMilestone, status: MilestoneStatus) {
    try {
      await update.mutateAsync({
        id: m.id,
        patch: {
          status,
          completedDate: status !== 'done' ? null : undefined,
        },
      })
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleResponsiblesChange(m: ProjectMilestone, userIds: string[]) {
    try {
      await update.mutateAsync({ id: m.id, patch: { responsibleIds: userIds } })
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleProgressChange(m: ProjectMilestone, value: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)))
    try {
      await update.mutateAsync({ id: m.id, patch: { progressPct: clamped } })
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDelete(m: ProjectMilestone) {
    const label = m.kind === 'group' ? 'grupo' : m.kind === 'task' ? 'tarefa' : 'subtarefa'
    const ok = await confirm({
      title: `Remover ${label}`,
      description: `Remover "${m.title}"? ${m.kind !== 'subtask' ? 'Filhos serão mantidos órfãos.' : ''}`,
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(m.id)
      toastDeleted(`${label.charAt(0).toUpperCase()}${label.slice(1)} removida`)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  const statusOptions = (Object.entries(MILESTONE_STATUS_LABELS) as Array<[MilestoneStatus, string]>)
    .map(([value, label]) => ({ value, label }))

  function renderTaskRow(t: ProjectMilestone, level: 1 | 2) {
    const isCollapsed = collapsed.has(t.id)
    const subtasks = tree.subtasksByParent[t.id] || []
    const hasChildren = subtasks.length > 0
    const indentClass = level === 1 ? 'pl-4' : 'pl-12'
    return (
      <div key={t.id}>
        <div className={`group flex items-center gap-3 py-2 ${indentClass} pr-3 border-b border-border/50 hover:bg-muted/30 transition-colors`}>
          {hasChildren ? (
            <button
              onClick={() => toggleCollapse(t.id)}
              className="text-muted-foreground hover:text-foreground"
              type="button"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <div className="w-4 h-4" />
          )}
          <button
            type="button"
            onClick={() => canEdit && handleStatusChange(t, t.status === 'done' ? 'in_progress' : 'done')}
            disabled={!canEdit}
            className="text-muted-foreground hover:text-emerald-600 disabled:cursor-not-allowed"
          >
            {t.status === 'done'
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <Circle className="h-4 w-4" />}
          </button>
          <span className={`flex-1 text-sm ${t.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
            {t.title}
          </span>
          {t.plannedDate && (
            <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
              {fmtDate(t.plannedDate)}
            </span>
          )}
          <div className="w-32">
            <Combobox
              options={statusOptions}
              value={t.status}
              onChange={(v) => canEdit && handleStatusChange(t, v as MilestoneStatus)}
              disabled={!canEdit}
            />
          </div>
          <div className="w-36">
            <MultiPeoplePicker
              value={t.responsibleIds}
              users={users}
              onChange={(ids) => handleResponsiblesChange(t, ids)}
              disabled={!canEdit}
            />
          </div>
          <div className="w-20 flex items-center gap-1">
            {canEdit ? (
              <input
                type="number"
                min={0}
                max={100}
                value={t.progressPct ?? ''}
                onChange={(e) => handleProgressChange(t, Number(e.target.value))}
                placeholder="%"
                className="w-14 px-1.5 py-0.5 text-xs rounded border bg-background"
              />
            ) : (
              <span className="text-xs tabular-nums w-14 text-right">
                {t.progressPct !== null && t.progressPct !== undefined ? `${t.progressPct}%` : '—'}
              </span>
            )}
          </div>
          {customCols.map((c) => (
            <div key={c.id} className="w-32 px-1">
              {canEdit
                ? <ColumnCellEditor column={c} value={getValue(t.id, c.id)} onChange={(v) => setValue(t.id, c.id, v)} />
                : <ColumnCellReadonly column={c} value={getValue(t.id, c.id)} />}
            </div>
          ))}
          <ResponsibleAvatars ids={t.responsibleIds} users={users} />
          {canEdit && (
            <div className="flex items-center gap-0.5">
              {level === 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setAdding({ kind: 'subtask', parentId: t.id }); setNewTitle(''); setNewDate('') }}
                  title="Subtarefa"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} title="Remover">
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              </Button>
            </div>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div>
            {subtasks.map(s => renderTaskRow(s, 2))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-6 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-muted-foreground" />
            Tarefas
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {done}/{total} concluídas · grupos, tarefas e subtarefas
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColsModalOpen(true)}
              title="Gerenciar colunas customizadas"
            >
              <Settings2 className="h-4 w-4" /> Colunas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAdding({ kind: 'group', parentId: null }); setNewTitle(''); setNewDate('') }}
            >
              <Plus className="h-4 w-4" /> Grupo
            </Button>
            <Button
              size="sm"
              onClick={() => { setAdding({ kind: 'task', parentId: null }); setNewTitle(''); setNewDate('') }}
            >
              <Plus className="h-4 w-4" /> Tarefa
            </Button>
          </div>
        )}
      </div>

      {adding && canEdit && (
        <div className="mx-6 mb-3 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Nov{adding.kind === 'group' ? 'o grupo' : adding.kind === 'task' ? 'a tarefa' : 'a subtarefa'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Kickoff" autoFocus />
            </div>
            {adding.kind !== 'group' && (
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setAdding(null)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newTitle.trim() || create.isPending}>
              {create.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs de visualizacao */}
      <div className="px-6 pb-2 flex items-center gap-1 border-b">
        <button
          type="button"
          onClick={() => setView('list')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        ><List className="h-3.5 w-3.5" /> Lista</button>
        <button
          type="button"
          onClick={() => setView('kanban')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md ${view === 'kanban' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        ><LayoutGrid className="h-3.5 w-3.5" /> Kanban</button>
        <button
          type="button"
          onClick={() => setView('calendar')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md ${view === 'calendar' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        ><CalendarDays className="h-3.5 w-3.5" /> Calendario</button>
      </div>

      {view === 'kanban' && <TasksKanbanView tasks={items} projectId={projectId} canEdit={canEdit} />}
      {view === 'calendar' && <TasksCalendarView tasks={items} />}

      {view === 'list' && (list.isLoading ? (
        <div className="px-6 py-8 text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="px-6 py-8 text-sm text-muted-foreground italic">
          Nenhuma tarefa. {canEdit && 'Crie um grupo ou tarefa para começar.'}
        </div>
      ) : (
        <div className="border-t">
          {tree.rootTasks.map(t => renderTaskRow(t, 1))}
          {tree.rootGroups.map(group => {
            const isCollapsed = collapsed.has(group.id)
            const childTasks = tree.tasksByParent[group.id] || []
            return (
              <div key={group.id}>
                <div className="flex items-center gap-2 py-2 px-4 bg-primary/5 border-b">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(group.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <span className="font-semibold text-sm flex-1">{group.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{childTasks.length} tarefa{childTasks.length !== 1 ? 's' : ''}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${MILESTONE_STATUS_COLORS[group.status]}`}>
                    {MILESTONE_STATUS_LABELS[group.status]}
                  </span>
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setAdding({ kind: 'task', parentId: group.id }); setNewTitle(''); setNewDate('') }}
                        title="Tarefa neste grupo"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(group)} title="Remover">
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      </Button>
                    </>
                  )}
                </div>
                {!isCollapsed && childTasks.map(t => renderTaskRow(t, 1))}
              </div>
            )
          })}
        </div>
      ))}
      <ColumnsManager
        open={colsModalOpen}
        onClose={() => setColsModalOpen(false)}
        projectId={projectId}
        canManage={canEdit}
      />
    </Card>
  )
}
