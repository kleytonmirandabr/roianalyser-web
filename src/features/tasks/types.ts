/**
 * Tipos do módulo Tarefas (Sprint #211).
 *
 * Tarefa é uma atividade interna (Ligar, Reunião, Visita Comercial, Email...).
 * Cada uma é vinculada a uma entidade (oportunidade, projeto, contrato...) e
 * pode opcionalmente referenciar um TaskTemplate (= tipo de tarefa).
 *
 * IDs são BIGINT serializados como string (padrão do app pós-migração).
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskRecurrenceUnit = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface Task {
  id: string
  tenantId: string
  entityType: string
  entityId: string
  /** FK pro tipo de tarefa (taskTemplate). Opcional. */
  taskTemplateId: string | null
  title: string
  description: string | null
  /** ISO datetime — quando a tarefa deve acontecer/vencer. */
  dueAt: string | null
  /** Legado: data sem hora. Mantido em sync via trigger no DB. */
  dueDate: string | null
  /** ISO datetime — quando foi marcada como concluída. */
  completedAt: string | null
  completedBy: string | null
  reminderMinutesBefore: number | null
  /** Regra simples: DAILY:n, WEEKLY:n, MONTHLY:n. null = não recorre. */
  recurrenceRule: string | null
  recurrenceUntil: string | null
  /** Em recorrência, aponta pra primeira instância (a mãe). */
  parentTaskId: string | null
  responsibleIds: string[]
  status: TaskStatus
  priority: TaskPriority
  displayOrder: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateTaskInput {
  entityType: string
  entityId: string
  title: string
  description?: string | null
  taskTemplateId?: string | null
  dueAt?: string | null
  responsibleIds?: string[]
  status?: TaskStatus
  priority?: TaskPriority
  reminderMinutesBefore?: number | null
  recurrenceRule?: string | null
  recurrenceUntil?: string | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  taskTemplateId?: string | null
  dueAt?: string | null
  responsibleIds?: string[]
  status?: TaskStatus
  priority?: TaskPriority
  reminderMinutesBefore?: number | null
  recurrenceRule?: string | null
  recurrenceUntil?: string | null
}

export interface TaskListFilters {
  entityType?: string
  entityId?: string
  status?: TaskStatus[] | TaskStatus
  taskTemplateId?: string
  responsibleId?: string
  dueFrom?: string
  dueTo?: string
}
