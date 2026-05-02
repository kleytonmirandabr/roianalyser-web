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
  CalendarDays, FolderTree, LayoutGrid, List, Plus, Settings2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import {
  type MilestoneKind,
 
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
  useDeleteColumn,
  useProjectTaskColumns,
  usePutColumnValue,
  useUpdateColumn,
} from '@/features/projects2/hooks/use-project-task-columns'
import type { ProjectTaskColumn, TaskColumnValue } from '@/features/projects2/task-columns-types'
import { ColumnsManager } from '@/features/projects2/components/ColumnsManager'
import { TasksKanbanView } from '@/features/projects2/components/TasksKanbanView'
import { TasksCalendarView } from '@/features/projects2/components/TasksCalendarView'
import { TasksTableView } from '@/features/projects2/components/TasksTableView'
import { TasksToolbar, type TasksFilters } from '@/features/projects2/components/TasksToolbar'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'

interface Props {
  projectId: string | undefined
  canEdit: boolean
}

interface UserMini { id: string; name: string; email: string }




export function ProjectTasksCard({ projectId, canEdit }: Props) {
  const list = useProjectMilestones(projectId)
  const create = useCreateMilestone(projectId)
  const update = useUpdateMilestone(projectId)
  const remove = useDeleteMilestone(projectId)
  const colsList = useProjectTaskColumns(projectId)
  const customCols: ProjectTaskColumn[] = colsList.data || []
  const putValue = usePutColumnValue(projectId)
  const updateCol = useUpdateColumn(projectId)
  const deleteCol = useDeleteColumn(projectId)
  const [colsModalOpen, setColsModalOpen] = useState(false)
  const [filters, setFilters] = useState<TasksFilters>({ q: '', status: '', personId: '', sort: 'order' })
  const appState = useAppState()
  const users: UserMini[] = ((appState.data?.users || []) as Array<{ id: string; name?: string; email?: string }>)
    .map(u => ({ id: String(u.id), name: u.name || u.email || `User #${u.id}`, email: u.email || '' }))

  const items = list.data || []

  // Sprint 3.3: filtros + sort
  const filteredItems = useMemo(() => {
    let arr = items.slice()
    if (filters.q) {
      const q = filters.q.toLowerCase()
      arr = arr.filter((t) => t.title.toLowerCase().includes(q))
    }
    if (filters.status) arr = arr.filter((t) => t.status === filters.status)
    if (filters.personId) arr = arr.filter((t) => t.responsibleIds.includes(filters.personId))
    if (filters.sort === 'title') arr.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    else if (filters.sort === 'plannedDate') {
      arr.sort((a, b) => (a.plannedDate || '9999').localeCompare(b.plannedDate || '9999'))
    } else if (filters.sort === 'status') arr.sort((a, b) => a.status.localeCompare(b.status))
    else if (filters.sort === 'progress') arr.sort((a, b) => (b.progressPct || 0) - (a.progressPct || 0))
    return arr
  }, [items, filters])

  // Conta subtarefas por task (root e por grupo)
  const subtaskCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const it of items) {
      if (it.kind === 'subtask' && it.parentId) {
        map[it.parentId] = (map[it.parentId] || 0) + 1
      }
    }
    return map
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



  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 sm:p-6 pb-3 flex flex-wrap items-start justify-between gap-3">
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColsModalOpen(true)}
              title="Gerenciar colunas customizadas"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Colunas</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAdding({ kind: 'group', parentId: null }); setNewTitle(''); setNewDate('') }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Grupo</span>
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

      {view === 'list' && (
        <TasksToolbar filters={filters} onChange={(p) => setFilters(f => ({ ...f, ...p }))} users={users} />
      )}

      {view === 'kanban' && <TasksKanbanView tasks={filteredItems} projectId={projectId} canEdit={canEdit} />}
      {view === 'calendar' && <TasksCalendarView tasks={filteredItems} />}

      {view === 'list' && (list.isLoading ? (
        <div className="px-6 py-8 text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <TasksTableView
          items={filteredItems}
          customCols={customCols}
          valuesByTaskCol={valuesByTaskCol}
          users={users}
          canEdit={canEdit}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onUpdateTask={(id, patch) => update.mutateAsync({ id, patch }).catch(err => toastError(`Erro: ${(err as Error).message}`))}
          onDeleteTask={handleDelete}
          onAddTaskInGroup={(groupId) => { setAdding({ kind: 'task', parentId: groupId }); setNewTitle(''); setNewDate('') }}
          onAddSubtaskInTask={(taskId) => { setAdding({ kind: 'subtask', parentId: taskId }); setNewTitle(''); setNewDate('') }}
          onAddRootTask={() => { setAdding({ kind: 'task', parentId: null }); setNewTitle(''); setNewDate('') }}
          onPutColumnValue={setValue}
          onOpenColumnsManager={() => setColsModalOpen(true)}
          onRenameColumn={(colId, label) => updateCol.mutateAsync({ id: colId, patch: { label } }).catch(err => toastError(`Erro: ${(err as Error).message}`))}
          onDeleteColumn={async (colId) => {
            const ok = await confirm({ title: 'Excluir coluna?', description: 'Os valores serão apagados.', confirmLabel: 'Excluir', destructive: true })
            if (ok) deleteCol.mutateAsync(colId).catch(err => toastError(`Erro: ${(err as Error).message}`))
          }}
          subtaskCount={subtaskCount}
        />
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
