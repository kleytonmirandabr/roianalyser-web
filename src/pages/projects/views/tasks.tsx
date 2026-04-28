import { Check, LayoutList, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'

import { MultiUserSelect } from '@/features/admin/components/user-select'
import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { useProject } from '@/features/projects/hooks/use-project'
import { useUpdateProject } from '@/features/projects/hooks/use-update-project'
import {
  makeTask,
  readTasks,
  scheduleStatus,
  serializeTasks,
  type ScheduleStatus,
  type Task,
} from '@/features/projects/lib/tasks'
import type { ProjectPayload } from '@/features/projects/types'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { cn } from '@/shared/lib/cn'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

type ViewMode = 'list' | 'kanban'

/**
 * Aba "Tarefas" do projeto. Permite criar/editar/concluir/excluir tarefas
 * vinculadas ao projeto, com duas visualizações: lista (com filtros) e
 * Kanban agrupado por taskType.
 */
export function ProjectTasksView() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const update = useUpdateProject(params.id ?? '')
  const taskCatalog = useCatalog('taskCatalogs')

  const [view, setView] = useState<ViewMode>('list')
  const [editing, setEditing] = useState<Task | null>(null)

  // Atalho: chegando com `?new=1` (vindo do botão "+ tarefa" do Kanban
  // de projetos), abre direto o sheet de nova tarefa. Limpa a query
  // depois pra não reabrir em refresh.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(makeTask())
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const tasks = useMemo<Task[]>(
    () => readTasks(project.data?.payload as Record<string, unknown> | null),
    [project.data],
  )

  async function persist(next: Task[], successMsg: string) {
    if (!project.data) return
    const base = (project.data.payload ?? {}) as Record<string, unknown>
    const payload: ProjectPayload = { ...base, tasks: serializeTasks(next) }
    try {
      await update.mutateAsync({ payload })
      toastSaved(successMsg)
    } catch (err) {
      toastError(err)
    }
  }

  async function saveTask(task: Task) {
    const exists = tasks.some((t) => t.id === task.id)
    const next = exists
      ? tasks.map((t) => (t.id === task.id ? { ...task, updatedAt: new Date().toISOString() } : t))
      : [
          ...tasks,
          { ...task, createdAt: new Date().toISOString() },
        ]
    setEditing(null)
    await persist(next, t('projects.detail.tasks.saved'))
  }

  async function toggleComplete(task: Task) {
    const next: Task[] = tasks.map((tt) =>
      tt.id === task.id
        ? {
            ...tt,
            status: (tt.status === 'completed' ? 'pending' : 'completed') as Task['status'],
            updatedAt: new Date().toISOString(),
          }
        : tt,
    )
    await persist(next, t('projects.detail.tasks.statusChanged'))
  }

  async function deleteTask(task: Task) {
    const ok = await confirm({
      title: t('projects.detail.tasks.deleteTitle'),
      description: t('projects.detail.tasks.deleteDesc', {
        subject: task.subject || '—',
      }),
      confirmLabel: t('common.cancel'),
      destructive: true,
    })
    if (!ok) return
    const next = tasks.filter((tt) => tt.id !== task.id)
    await persist(next, t('projects.detail.tasks.deleted'))
    toastDeleted()
  }

  if (!params.id) return null

  return (
    <div className="space-y-4">
      {project.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.detail.loadError')}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <Button
            size="sm"
            variant={view === 'list' ? 'default' : 'ghost'}
            onClick={() => setView('list')}
          >
            <LayoutList className="h-4 w-4" />
            <span>{t('projects.detail.tasks.viewList')}</span>
          </Button>
          <Button
            size="sm"
            variant={view === 'kanban' ? 'default' : 'ghost'}
            onClick={() => setView('kanban')}
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t('projects.detail.tasks.viewKanban')}</span>
          </Button>
        </div>
        <Button onClick={() => setEditing(makeTask())}>
          <Plus className="h-4 w-4" />
          <span>{t('projects.detail.tasks.new')}</span>
        </Button>
      </div>

      {tasks.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('projects.detail.tasks.empty')}
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 &&
        (view === 'list' ? (
          <TasksTable
            tasks={tasks}
            onEdit={setEditing}
            onToggle={toggleComplete}
            onDelete={deleteTask}
          />
        ) : (
          <TasksKanban
            tasks={tasks}
            onEdit={setEditing}
            taskTypeOptions={(taskCatalog.data ?? [])
              .filter((it) => it.active !== false)
              .map((it) => String(it.taskType ?? it.name ?? ''))
              .filter(Boolean)}
          />
        ))}

      {editing && (
        <TaskForm
          initial={editing}
          taskTypeOptions={(taskCatalog.data ?? [])
            .filter((it) => it.active !== false)
            .map((it) => String(it.taskType ?? it.name ?? ''))
            .filter(Boolean)}
          scopeClientId={
            (typeof project.data?.clientId === 'string'
              ? project.data.clientId
              : null) ?? null
          }
          onCancel={() => setEditing(null)}
          onSave={saveTask}
          saving={update.isPending}
        />
      )}
    </div>
  )
}

function statusToneClass(status: ScheduleStatus) {
  if (status === 'completed') return 'text-emerald-600'
  if (status === 'overdue') return 'text-destructive'
  return 'text-amber-600'
}

function TasksTable({
  tasks,
  onEdit,
  onToggle,
  onDelete,
}: {
  tasks: Task[]
  onEdit: (t: Task) => void
  onToggle: (t: Task) => void
  onDelete: (t: Task) => void
}) {
  const { t } = useTranslation()
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>{t('projects.detail.tasks.th.subject')}</TableHead>
            <TableHead className="w-32">{t('projects.detail.tasks.th.type')}</TableHead>
            <TableHead className="w-32">{t('projects.detail.tasks.th.scheduled')}</TableHead>
            <TableHead className="w-28">{t('projects.detail.tasks.th.status')}</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const sched = scheduleStatus(task)
            return (
              <TableRow key={task.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => onToggle(task)}
                    className="h-4 w-4 cursor-pointer"
                    aria-label={t('projects.detail.tasks.toggleAria')}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onEdit(task)}
                    className={cn(
                      'text-left text-sm font-medium hover:underline',
                      task.status === 'completed' && 'text-muted-foreground line-through',
                    )}
                  >
                    {task.subject || '—'}
                  </button>
                  {task.description && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {task.taskType || '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {task.scheduledDate
                    ? `${task.scheduledDate}${task.scheduledTime ? ' ' + task.scheduledTime : ''}`
                    : '—'}
                </TableCell>
                <TableCell>
                  <span className={cn('text-xs font-medium', statusToneClass(sched))}>
                    {t(`projects.detail.tasks.sched.${sched}`)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <IconTooltip label={t('catalogs.detail.delete')}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(task)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </IconTooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

function TasksKanban({
  tasks,
  onEdit,
  taskTypeOptions,
}: {
  tasks: Task[]
  onEdit: (t: Task) => void
  taskTypeOptions: string[]
}) {
  const { t } = useTranslation()
  // Tipos derivados das tasks + opções do catálogo, sempre incluindo
  // "(sem tipo)" se houver tasks sem tipo.
  const types = useMemo(() => {
    const s = new Set<string>(taskTypeOptions)
    tasks.forEach((tt) => {
      if (tt.taskType) s.add(tt.taskType)
    })
    const list = [...s].sort((a, b) => a.localeCompare(b))
    if (tasks.some((tt) => !tt.taskType)) list.unshift('')
    return list
  }, [tasks, taskTypeOptions])

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {types.map((type) => {
        const colTasks = tasks.filter((tt) => (tt.taskType || '') === type)
        return (
          <div
            key={type || '__none__'}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-md border border-border bg-card p-2"
          >
            <div className="flex items-center justify-between border-b-2 px-2 pb-2">
              <span className="text-sm font-semibold">
                {type || t('projects.detail.tasks.noType')}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {colTasks.length}
              </span>
            </div>
            {colTasks.map((task) => {
              const sched = scheduleStatus(task)
              return (
                <Card
                  key={task.id}
                  className="cursor-pointer p-3 transition-colors hover:border-primary"
                  onClick={() => onEdit(task)}
                >
                  <div
                    className={cn(
                      'text-sm font-medium',
                      task.status === 'completed' &&
                        'text-muted-foreground line-through',
                    )}
                  >
                    {task.subject || '—'}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground tabular-nums">
                      {task.scheduledDate || '—'}
                    </span>
                    <span className={cn('font-medium', statusToneClass(sched))}>
                      {t(`projects.detail.tasks.sched.${sched}`)}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function TaskForm({
  initial,
  taskTypeOptions,
  scopeClientId,
  onCancel,
  onSave,
  saving,
}: {
  initial: Task
  taskTypeOptions: string[]
  /** Tenant do projeto. Restringe lista de responsáveis a usuários desse tenant. */
  scopeClientId?: string | null
  onCancel: () => void
  onSave: (task: Task) => Promise<void> | void
  saving: boolean
}) {
  const { t } = useTranslation()
  const [task, setTask] = useState<Task>(initial)
  useEffect(() => setTask(initial), [initial])

  function patch<K extends keyof Task>(key: K, value: Task[K]) {
    setTask((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {initial.subject
            ? t('projects.detail.tasks.editTitle')
            : t('projects.detail.tasks.newTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave(task)
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="task-subject">
              {t('projects.detail.tasks.field.subject')}
              <span className="text-destructive"> *</span>
            </Label>
            <Input
              id="task-subject"
              value={task.subject}
              onChange={(e) => patch('subject', e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="task-desc">{t('projects.detail.tasks.field.description')}</Label>
            <Input
              id="task-desc"
              value={task.description ?? ''}
              onChange={(e) => patch('description', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-type">{t('projects.detail.tasks.field.type')}</Label>
            <Input
              id="task-type"
              list="task-type-options"
              value={task.taskType ?? ''}
              onChange={(e) => patch('taskType', e.target.value)}
              placeholder={t('projects.detail.tasks.field.typePlaceholder')}
            />
            {taskTypeOptions.length > 0 && (
              <datalist id="task-type-options">
                {taskTypeOptions.map((tt) => (
                  <option key={tt} value={tt} />
                ))}
              </datalist>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-date">{t('projects.detail.tasks.field.date')}</Label>
              <Input
                id="task-date"
                type="date"
                value={task.scheduledDate ?? ''}
                onChange={(e) => patch('scheduledDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-time">{t('projects.detail.tasks.field.time')}</Label>
              <Input
                id="task-time"
                type="time"
                value={task.scheduledTime ?? ''}
                onChange={(e) => patch('scheduledTime', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('projects.detail.tasks.field.responsible')}</Label>
            <MultiUserSelect
              values={task.responsibleIds ?? []}
              onChange={(ids) => patch('responsibleIds', ids)}
              scopeClientId={scopeClientId}
            />
          </div>

          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !task.subject.trim()}>
              {task.status === 'completed' && (
                <Check className="h-4 w-4" />
              )}
              <span>{saving ? t('app.loading') : t('common.submit')}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
