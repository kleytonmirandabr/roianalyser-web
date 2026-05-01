import { api } from '@/shared/api/client'
import type {
  CreateColumnInput, ProjectTaskColumn, TaskColumnValue, UpdateColumnInput,
} from './task-columns-types'

const base = (pid: string) => `/projects2/${encodeURIComponent(pid)}`

export const projectTaskColumnsApi = {
  list: (projectId: string) =>
    api.get<{ items: ProjectTaskColumn[] }>(`${base(projectId)}/columns`).then(r => r.items),

  create: (projectId: string, input: CreateColumnInput) =>
    api.post<{ item: ProjectTaskColumn }>(`${base(projectId)}/columns`, input).then(r => r.item),

  update: (projectId: string, columnId: string, patch: UpdateColumnInput) =>
    api.patch<{ item: ProjectTaskColumn }>(
      `${base(projectId)}/columns/${encodeURIComponent(columnId)}`,
      patch,
    ).then(r => r.item),

  remove: (projectId: string, columnId: string) =>
    api.delete<void>(`${base(projectId)}/columns/${encodeURIComponent(columnId)}`),

  listValues: (projectId: string, taskIds: string[]) => {
    if (taskIds.length === 0) return Promise.resolve([] as TaskColumnValue[])
    const qs = `?taskIds=${encodeURIComponent(taskIds.join(','))}`
    return api.get<{ items: TaskColumnValue[] }>(`${base(projectId)}/column-values${qs}`).then(r => r.items)
  },

  putValue: (projectId: string, taskId: string, columnId: string, value: any) =>
    api.put<{ item: TaskColumnValue }>(
      `${base(projectId)}/tasks/${encodeURIComponent(taskId)}/columns/${encodeURIComponent(columnId)}/value`,
      { value },
    ).then(r => r.item),
}
