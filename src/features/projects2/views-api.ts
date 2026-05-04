import type { ProjectView, ViewConfig, ViewType } from './view-types'
import { api } from '@/shared/api/client'

const base = (projectId: string) => `/projects/${projectId}/views`

export const viewsApi = {
  list: (projectId: string) =>
    api.get<ProjectView[]>(base(projectId)),

  create: (projectId: string, data: { type: ViewType; name: string; config?: ViewConfig }) =>
    api.post<ProjectView>(base(projectId), data),

  update: (projectId: string, viewId: string, data: Partial<{ name: string; config: ViewConfig; position: number; enabled: boolean }>) =>
    api.put<ProjectView>(`${base(projectId)}/${viewId}`, data),

  remove: (projectId: string, viewId: string) =>
    api.delete(`${base(projectId)}/${viewId}`),
}
