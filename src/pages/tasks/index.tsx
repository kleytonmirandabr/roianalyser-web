/**
 * Página /tasks — Sprint #211.
 *
 * Tela única com toggle Calendário (default) / Lista. Mostra as tarefas
 * do user logado por padrão (filtro responsibleId) e permite expandir
 * para "Todos" via toggle.
 *
 * Lista: multi-seleção + botão "Finalizar selecionadas" → bulk-complete.
 * Calendário: grid mensal simples agrupando dueAt por dia.
 */
import { useMemo, useState } from 'react'
import {
  Calendar as CalendarIcon, ListTodo, Plus, AlertTriangle, CheckCircle2,
  ChevronLeft, ChevronRight, Filter, BarChart3,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import {
  useTasks, useBulkCompleteTasks, useCompleteTask,
} from '@/features/tasks/hooks/use-tasks'
import { TaskFormSheet } from '@/features/tasks/components/task-form-sheet'
import type { Task, TaskStatus } from '@/features/tasks/types'
import { useTaskTemplates } from '@/features/task-templates/hooks/use-task-templates'

import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { formatDateTime } from '@/shared/lib/format'
import { useUserTimezone } from '@/shared/lib/use-user-timezone'

type ViewMode = 'calendar' | 'list'
type QuickRange = 'all' | 'today' | 'overdue' | 'thisWeek' | 'next30'

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x }

function isOverdue(task: Task): boolean {
  if (!task.dueAt) return false
  if (task.status === 'completed' || task.status === 'cancelled') return false
  return new Date(task.dueAt).getTime() < Date.now()
}

function statusBadge(status: TaskStatus) {
  const map: Record<TaskStatus, { label: string; cls: string }> = {
    pending:     { label: 'Pendente',    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' },
    in_progress: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300' },
    completed:   { label: 'Concluída',   cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' },
    cancelled:   { label: 'Cancelada',   cls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  }
  const m = map[status]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    low:    'bg-zinc-100 text-zinc-700',
    medium: 'bg-blue-100 text-blue-700',
    high:   'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = { low:'Baixa', medium:'Média', high:'Alta', urgent:'Urgente' }
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${map[p] || map.medium}`}>{labels[p] || p}</span>
}

export function TasksPage() {
  const tz = useUserTimezone()
  const { user } = useAuth()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>
  const { data: templates = [] } = useTaskTemplates()
  const { data: opps = [] } = useOpportunities()

  const [view, setView] = useState<ViewMode>('calendar')
  /* Default 'all' pra master (ve tudo do tenant), 'me' pra usuario comum.
     Evita confusao ao criar tarefa pra outro user e parecer "nao salvou". */
  const [scope, setScope] = useState<'me' | 'all'>(user?.isMaster ? 'all' : 'me')
  const [quickRange, setQuickRange] = useState<QuickRange>('all')
  const [statusFilter, setStatusFilter] = useState<'open' | 'all' | 'completed'>('open')
  const [calMonth, setCalMonth] = useState(() => startOfDay(new Date()))

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filters = useMemo(() => {
    const f: Record<string, any> = {}
    if (scope === 'me' && user?.id) f.responsibleId = String(user.id)
    if (statusFilter === 'open') f.status = ['pending','in_progress']
    else if (statusFilter === 'completed') f.status = ['completed']
    if (quickRange === 'today') {
      f.dueFrom = startOfDay(new Date()).toISOString()
      f.dueTo = endOfDay(new Date()).toISOString()
    } else if (quickRange === 'overdue') {
      f.dueTo = new Date().toISOString()
      f.status = ['pending','in_progress']
    } else if (quickRange === 'thisWeek') {
      const now = new Date()
      const day = now.getDay()
      const monday = addDays(now, day === 0 ? -6 : 1 - day)
      f.dueFrom = startOfDay(monday).toISOString()
      f.dueTo = endOfDay(addDays(monday, 6)).toISOString()
    } else if (quickRange === 'next30') {
      f.dueFrom = startOfDay(new Date()).toISOString()
      f.dueTo = endOfDay(addDays(new Date(), 30)).toISOString()
    }
    return f
  }, [scope, statusFilter, quickRange, user?.id])

  const tasksQ = useTasks(filters)
  const bulk = useBulkCompleteTasks()
  const completeOne = useCompleteTask()

  const allTasks = (tasksQ.data ?? []) as Task[]

  const userById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of tenantUsers) {
      if (u.id) m.set(String(u.id), u.name || u.email || String(u.id))
    }
    return m
  }, [tenantUsers])

  const tplById = useMemo(() => {
    const m = new Map<string, string>()
    for (const tpl of templates) m.set(String(tpl.id), tpl.name)
    return m
  }, [templates])

  const oppById = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of opps) m.set(String(o.id), o.name)
    return m
  }, [opps])

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  async function handleBulkFinalize() {
    if (selectedIds.size === 0) return
    try {
      const updated = await bulk.mutateAsync(Array.from(selectedIds))
      toastSaved(`${updated} tarefa(s) finalizada(s)`)
      clearSelection()
    } catch (err: any) {
      toastError(err?.message || 'Falha ao finalizar tarefas.')
    }
  }

  async function handleCompleteOne(t: Task) {
    try {
      await completeOne.mutateAsync(t.id)
      toastSaved('Tarefa finalizada')
    } catch (err: any) {
      toastError(err?.message || 'Falha ao finalizar tarefa.')
    }
  }

  const counts = useMemo(() => {
    let overdue = 0, today = 0, week = 0
    const now = new Date()
    const todayEnd = endOfDay(now).getTime()
    const weekEnd = endOfDay(addDays(now, 7)).getTime()
    for (const t of allTasks) {
      if (!t.dueAt) continue
      if (t.status === 'completed' || t.status === 'cancelled') continue
      const ms = new Date(t.dueAt).getTime()
      if (ms < Date.now()) overdue++
      else if (ms <= todayEnd) today++
      else if (ms <= weekEnd) week++
    }
    return { overdue, today, week, total: allTasks.length }
  }, [allTasks])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            {scope === 'me' ? 'Minhas tarefas' : 'Tarefas do tenant'} · {counts.total} no filtro atual
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-background p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setView('calendar')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            ><CalendarIcon className="h-3.5 w-3.5" /> Calendário</button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            ><ListTodo className="h-3.5 w-3.5" /> Lista</button>
            <Link
              to="/tasks/dashboard"
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"
            ><BarChart3 className="h-3.5 w-3.5" /> Dashboard</Link>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar tarefa
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setScope('me')}
              className={`rounded px-2 py-1 ${scope === 'me' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >Minhas</button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`rounded px-2 py-1 ${scope === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >Todas</button>
          </div>

          <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
            {([
              { v:'all',     l:'Todas' },
              { v:'today',   l:'Hoje' },
              { v:'overdue', l:`Vencidas${counts.overdue ? ` (${counts.overdue})` : ''}` },
              { v:'thisWeek',l:'Esta semana' },
              { v:'next30',  l:'Próximos 30' },
            ] as Array<{ v: QuickRange; l: string }>).map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setQuickRange(opt.v)}
                className={`rounded px-2 py-1 ${quickRange === opt.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >{opt.l}</button>
            ))}
          </div>

          <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
            {([
              { v:'open',     l:'Em aberto' },
              { v:'all',      l:'Todos status' },
              { v:'completed',l:'Concluídas' },
            ] as Array<{ v: typeof statusFilter; l: string }>).map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setStatusFilter(opt.v as any)}
                className={`rounded px-2 py-1 ${statusFilter === opt.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >{opt.l}</button>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selectedIds.size} selecionada(s)</span>
              <Button size="sm" variant="outline" onClick={clearSelection}>Limpar</Button>
              <Button size="sm" onClick={handleBulkFinalize} disabled={bulk.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {bulk.isPending ? 'Finalizando...' : 'Finalizar selecionadas'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {tasksQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : view === 'list' ? (
        <TaskList
          tasks={allTasks}
          tz={tz}
          oppById={oppById}
          userById={userById}
          tplById={tplById}
          selectedIds={selectedIds}
          onToggle={toggleId}
          onEdit={(t) => setEditing(t)}
          onComplete={handleCompleteOne}
        />
      ) : (
        <CalendarView
          tasks={allTasks}
          month={calMonth}
          userById={userById}
          tplById={tplById}
          oppById={oppById}
          onPrev={() => setCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth()-1); return x })}
          onNext={() => setCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth()+1); return x })}
          onToday={() => setCalMonth(startOfDay(new Date()))}
          onOpen={(t) => setEditing(t)}
        />
      )}

      <TaskFormSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <TaskFormSheet
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

interface TaskListProps {
  tasks: Task[]
  tz: string
  oppById: Map<string, string>
  userById: Map<string, string>
  tplById: Map<string, string>
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onEdit: (t: Task) => void
  onComplete: (t: Task) => void
}

function TaskList({ tasks, tz, oppById, userById, tplById, selectedIds, onToggle, onEdit, onComplete }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa encontrada com os filtros atuais.
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-1.5">
      {tasks.map(t => {
        const overdue = isOverdue(t)
        const checked = selectedIds.has(t.id)
        const respName = t.responsibleIds?.[0] ? userById.get(String(t.responsibleIds[0])) : null
        const tplName = t.taskTemplateId ? tplById.get(String(t.taskTemplateId)) : null
        const oppName = t.entityType === 'opportunity' ? oppById.get(String(t.entityId)) : null
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-md border bg-card p-3 transition-colors ${overdue ? 'border-red-300 bg-red-50/30 dark:bg-red-950/10' : ''}`}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={checked}
              onChange={() => onToggle(t.id)}
              aria-label="Selecionar tarefa"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className="text-sm font-medium hover:underline text-left"
                >
                  {t.title}
                </button>
                {overdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/30 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3" /> ATRASADA
                  </span>
                )}
                {statusBadge(t.status)}
                {priorityBadge(t.priority)}
                {tplName && (
                  <span className="text-xs text-muted-foreground">· {tplName}</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {t.dueAt && (
                  <span>
                    <CalendarIcon className="mr-1 inline h-3 w-3" />
                    {formatDateTime(t.dueAt, tz)}
                  </span>
                )}
                {respName && <span>👤 {respName}</span>}
                {oppName && <span>🎯 {oppName}</span>}
                {t.recurrenceRule && <span>↻ {t.recurrenceRule}</span>}
              </div>
              {t.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {t.status !== 'completed' && t.status !== 'cancelled' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onComplete(t)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finalizar
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface CalendarProps {
  tasks: Task[]
  month: Date
  userById: Map<string, string>
  tplById: Map<string, string>
  oppById: Map<string, string>
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onOpen: (t: Task) => void
}

function CalendarView({ tasks, month, userById, tplById, oppById, onPrev, onNext, onToday, onOpen }: CalendarProps) {
  const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const startWeekday = firstOfMonth.getDay() // 0=domingo
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

  const cells: Array<{ date: Date | null }> = []
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null })
  for (let i = 1; i <= daysInMonth; i++) cells.push({ date: new Date(month.getFullYear(), month.getMonth(), i) })
  while (cells.length % 7 !== 0) cells.push({ date: null })

  const tasksByDay = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.dueAt) continue
    const d = new Date(t.dueAt)
    if (d.getFullYear() !== month.getFullYear() || d.getMonth() !== month.getMonth()) continue
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!tasksByDay.has(key)) tasksByDay.set(key, [])
    tasksByDay.get(key)!.push(t)
  }

  const today = new Date()
  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={onToday}>Hoje</Button>
            <Button size="sm" variant="outline" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h2 className="text-sm font-semibold capitalize">{monthLabel}</h2>
          <div className="text-xs text-muted-foreground">{tasks.filter(t => t.dueAt).length} tarefas com data</div>
        </div>
        <div className="grid grid-cols-7 gap-px rounded border bg-border text-xs">
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
            <div key={d} className="bg-muted/40 px-2 py-1 text-center font-semibold">{d}</div>
          ))}
          {cells.map((c, i) => {
            if (!c.date) return <div key={i} className="bg-background min-h-24" />
            const key = `${c.date.getFullYear()}-${c.date.getMonth()}-${c.date.getDate()}`
            const dayTasks = tasksByDay.get(key) ?? []
            const isToday = c.date.toDateString() === today.toDateString()
            return (
              <div key={i} className={`bg-background min-h-24 p-1 ${isToday ? 'ring-2 ring-primary/40 ring-inset' : ''}`}>
                <div className={`mb-0.5 text-right text-xs ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                  {c.date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map(t => {
                    const overdue = isOverdue(t)
                    const time = t.dueAt ? new Date(t.dueAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
                    const respName = t.responsibleIds?.[0] ? userById.get(String(t.responsibleIds[0])) : null
                    const tplName = t.taskTemplateId ? tplById.get(String(t.taskTemplateId)) : null
                    const oppName = t.entityType === 'opportunity' ? oppById.get(String(t.entityId)) : null
                    const cls =
                      t.status === 'completed' ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200' :
                      overdue ? 'bg-red-100 text-red-900 hover:bg-red-200' :
                      t.priority === 'urgent' ? 'bg-orange-100 text-orange-900 hover:bg-orange-200' :
                      t.priority === 'high' ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' :
                      'bg-blue-100 text-blue-900 hover:bg-blue-200'
                    const tooltip = [
                      t.title,
                      time && `Hora: ${time}`,
                      tplName && `Tipo: ${tplName}`,
                      respName && `Resp: ${respName}`,
                      oppName && `Opp: ${oppName}`,
                      `Prioridade: ${t.priority}`,
                      overdue && 'ATRASADA',
                    ].filter(Boolean).join('\n')
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => onOpen(t)}
                        className={`block w-full rounded px-1.5 py-1 text-left text-[10px] leading-tight transition-colors ${cls}`}
                        title={tooltip}
                      >
                        <div className="flex items-baseline gap-1">
                          {time && <span className="font-semibold tabular-nums">{time}</span>}
                          {(t.priority === 'urgent' || overdue) && <span className="text-[8px] font-bold uppercase">{overdue ? 'ATRASADA' : 'URGENTE'}</span>}
                        </div>
                        <div className="truncate font-medium">{t.title}</div>
                        {(respName || tplName) && (
                          <div className="truncate text-[9px] opacity-80">
                            {respName && `👤 ${respName}`}
                            {respName && tplName && ' · '}
                            {tplName && tplName}
                          </div>
                        )}
                        {oppName && (
                          <div className="truncate text-[9px] opacity-70">🎯 {oppName}</div>
                        )}
                      </button>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <div className="px-1.5 text-[10px] text-muted-foreground">+{dayTasks.length - 3} mais</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
