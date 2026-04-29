import { api } from '@/shared/api/client'
import type {
  CreateTaskInput, Task, TaskListFilters, UpdateTaskInput,
} from './types'

function buildQuery(filters?: TaskListFilters): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  if (filters.entityType) params.set('entityType', filters.entityType)
  if (filters.entityId) params.set('entityId', String(filters.entityId))
  if (filters.taskTemplateId) params.set('taskTemplateId', String(filters.taskTemplateId))
  if (filters.responsibleId) params.set('responsibleId', String(filters.responsibleId))
  if (filters.dueFrom) params.set('dueFrom', filters.dueFrom)
  if (filters.dueTo) params.set('dueTo', filters.dueTo)
  if (filters.status) {
    const arr = Array.isArray(filters.status) ? filters.status : [filters.status]
    if (arr.length) params.set('status', arr.join(','))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const tasksApi = {
  list: (filters?: TaskListFilters) =>
    api.get<{ items: Task[] }>(`/tasks${buildQuery(filters)}`).then(r => r.items),

  get: (id: string) =>
    api.get<{ item: Task }>(`/tasks/${encodeURIComponent(id)}`).then(r => r.item),

  create: (input: CreateTaskInput) =>
    api.post<{ item: Task; recurrenceCount?: number }>('/tasks', input)
      .then(r => ({ item: r.item, recurrenceCount: r.recurrenceCount ?? 0 })),

  update: (id: string, input: UpdateTaskInput) =>
    api.patch<{ item: Task }>(`/tasks/${encodeURIComponent(id)}`, input).then(r => r.item),

  delete: (id: string) =>
    api.delete<void>(`/tasks/${encodeURIComponent(id)}`),

  complete: (id: string) =>
    api.post<{ item: Task }>(`/tasks/${encodeURIComponent(id)}/complete`).then(r => r.item),

  bulkComplete: (ids: string[]) =>
    api.post<{ updated: number }>(`/tasks/bulk-complete`, { ids }).then(r => r.updated),
}
