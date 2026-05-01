import { api } from '@/shared/api/client'
import type {
  CreateProjectInput, ListProjectsFilters, Project, UpdateProjectInput,
} from './types'

function qs(f: ListProjectsFilters = {}): string {
  const p = new URLSearchParams()
  if (f.status) p.set('status', Array.isArray(f.status) ? f.status.join(',') : f.status)
  if (f.managerId) p.set('managerId', f.managerId)
  if (f.clientId) p.set('clientId', f.clientId)
  if (f.contractId) p.set('contractId', f.contractId)
  if (f.opportunityId) p.set('opportunityId', f.opportunityId)
  if (f.tenantId) p.set('tenantId', f.tenantId)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const projects2Api = {
  list: (f: ListProjectsFilters = {}) =>
    api.get<{ items: Project[] }>(`/projects2${qs(f)}`).then(r => r.items),
  getById: (id: string) =>
    api.get<{ item: Project }>(`/projects2/${encodeURIComponent(id)}`).then(r => r.item),
  create: (input: CreateProjectInput) =>
    api.post<{ item: Project }>('/projects2', input).then(r => r.item),
  update: (id: string, input: UpdateProjectInput) =>
    api.patch<{ item: Project }>(`/projects2/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/projects2/${encodeURIComponent(id)}`),
}
