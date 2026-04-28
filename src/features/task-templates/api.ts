import { api } from '@/shared/api/client'
import type {
  CreateTaskTemplateInput, TaskTemplate, UpdateTaskTemplateInput,
} from './types'

export const taskTemplatesApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: TaskTemplate[] }>(`/task-templates${qs}`).then(r => r.items)
  },
  create: (input: CreateTaskTemplateInput) =>
    api.post<{ item: TaskTemplate }>('/task-templates', input).then(r => r.item),
  update: (id: string, input: UpdateTaskTemplateInput) =>
    api.patch<{ item: TaskTemplate }>(`/task-templates/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/task-templates/${encodeURIComponent(id)}`),
}
