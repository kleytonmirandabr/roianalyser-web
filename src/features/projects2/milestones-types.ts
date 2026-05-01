/**
 * Tipos de Tasks/Milestones (Phase 1 — Monday-like).
 *
 * Mantém o nome `milestones` por compatibilidade com endpoints
 * existentes, mas semanticamente é "tasks" do projeto agora —
 * com 3 níveis (group → task → subtask), multi-responsáveis e
 * status expandido.
 */

export type MilestoneStatus = 'planning' | 'in_progress' | 'waiting' | 'done' | 'cancelled'

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  planning: 'Planejando',
  in_progress: 'Em andamento',
  waiting: 'Aguardando',
  done: 'Concluído',
  cancelled: 'Cancelado',
}

export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  planning: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  waiting: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
}

export type MilestoneKind = 'group' | 'task' | 'subtask'

export const MILESTONE_KIND_LABELS: Record<MilestoneKind, string> = {
  group: 'Grupo',
  task: 'Tarefa',
  subtask: 'Subtarefa',
}

export type ProjectMilestone = {
  id: string
  projectId: string
  parentId: string | null
  kind: MilestoneKind
  title: string
  description: string | null
  plannedDate: string | null
  completedDate: string | null
  status: MilestoneStatus
  displayOrder: number
  progressPct: number | null
  responsibleIds: string[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateMilestoneInput = {
  title: string
  description?: string | null
  plannedDate?: string | null
  status?: MilestoneStatus
  displayOrder?: number
  parentId?: string | null
  kind?: MilestoneKind
  progressPct?: number | null
  responsibleIds?: string[] | null
}

export type UpdateMilestoneInput = Partial<CreateMilestoneInput> & {
  completedDate?: string | null
}
