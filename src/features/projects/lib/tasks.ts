/**
 * Tarefas vinculadas a um projeto. Persistidas em `project.payload.tasks`
 * (mesma estratégia das Entradas Dinâmicas — não há endpoint separado no
 * backend; todo CRUD é via PUT do contrato). Compatível com vanilla, que
 * lê do mesmo array.
 */

export type TaskStatus = 'pending' | 'completed'

export type Task = {
  id: string
  /** Título curto da tarefa. */
  subject: string
  /** Texto longo opcional. */
  description?: string
  /** Categorização (catálogo task-catalogs ou texto livre). Usado para
   * agrupar no Kanban. */
  taskType?: string
  /** YYYY-MM-DD. */
  scheduledDate?: string
  /** HH:MM. */
  scheduledTime?: string
  status: TaskStatus
  /** IDs dos responsáveis (catálogo de usuários). Texto livre por enquanto. */
  responsibleIds?: string[]
  responsibleNames?: string[]
  createdAt?: string
  updatedAt?: string
}

let __idCounter = 0
function nextId(): string {
  __idCounter += 1
  return `task_${Date.now().toString(36)}_${__idCounter}`
}

export function makeTask(partial?: Partial<Task>): Task {
  return {
    id: partial?.id ?? nextId(),
    subject: partial?.subject ?? '',
    description: partial?.description ?? '',
    taskType: partial?.taskType ?? '',
    scheduledDate: partial?.scheduledDate ?? '',
    scheduledTime: partial?.scheduledTime ?? '',
    status: partial?.status === 'completed' ? 'completed' : 'pending',
    responsibleIds: partial?.responsibleIds ?? [],
    responsibleNames: partial?.responsibleNames ?? [],
    createdAt: partial?.createdAt,
    updatedAt: partial?.updatedAt,
  }
}

export function readTasks(
  payload: Record<string, unknown> | null | undefined,
): Task[] {
  if (!payload) return []
  const raw = payload.tasks
  if (!Array.isArray(raw)) return []
  return raw.map((t) => {
    const r = t as Record<string, unknown>
    return makeTask({
      id: typeof r.id === 'string' ? r.id : undefined,
      subject: typeof r.subject === 'string' ? r.subject : '',
      description: typeof r.description === 'string' ? r.description : '',
      taskType: typeof r.taskType === 'string' ? r.taskType : '',
      scheduledDate:
        typeof r.scheduledDate === 'string' ? r.scheduledDate : '',
      scheduledTime:
        typeof r.scheduledTime === 'string' ? r.scheduledTime : '',
      status: r.status === 'completed' ? 'completed' : 'pending',
      responsibleIds: Array.isArray(r.responsibleIds)
        ? (r.responsibleIds as unknown[]).map(String)
        : [],
      responsibleNames: Array.isArray(r.responsibleNames)
        ? (r.responsibleNames as unknown[]).map(String)
        : [],
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : undefined,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    })
  })
}

export function serializeTasks(tasks: Task[]) {
  return tasks.map((t) => ({
    id: t.id,
    subject: t.subject,
    description: t.description,
    taskType: t.taskType,
    scheduledDate: t.scheduledDate,
    scheduledTime: t.scheduledTime,
    status: t.status,
    responsibleIds: t.responsibleIds,
    responsibleNames: t.responsibleNames,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }))
}

/** Calcula o "schedule status" derivado: pending/overdue/completed. */
export type ScheduleStatus = 'pending' | 'overdue' | 'completed'

export function scheduleStatus(task: Task, now: Date = new Date()): ScheduleStatus {
  if (task.status === 'completed') return 'completed'
  if (!task.scheduledDate || !task.scheduledTime) return 'pending'
  const dt = new Date(`${task.scheduledDate}T${task.scheduledTime}:00`)
  if (Number.isNaN(dt.getTime())) return 'pending'
  return dt.getTime() < now.getTime() ? 'overdue' : 'pending'
}
