import { api } from '@/shared/api/client'
import type { CreateTemplateInput, ProjectTemplate, UpdateTemplateInput } from './templates-types'

export const projectTemplatesApi = {
  list: () =>
    api.get<{ items: ProjectTemplate[] }>('/project-templates').then(r => r.items),

  getById: (id: string) =>
    api.get<{ item: ProjectTemplate }>(`/project-templates/${encodeURIComponent(id)}`).then(r => r.item),

  create: (input: CreateTemplateInput) =>
    api.post<{ item: ProjectTemplate }>('/project-templates', input).then(r => r.item),

  update: (id: string, patch: UpdateTemplateInput) =>
    api.patch<{ item: ProjectTemplate }>(`/project-templates/${encodeURIComponent(id)}`, patch).then(r => r.item),

  remove: (id: string) =>
    api.delete<void>(`/project-templates/${encodeURIComponent(id)}`),
}
