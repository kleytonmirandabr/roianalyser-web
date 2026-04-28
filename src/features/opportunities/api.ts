import { api } from '@/shared/api/client'

import type {
  CreateOpportunityInput,
  ListOpportunitiesFilters,
  Opportunity,
  UpdateOpportunityInput,
} from './types'

function buildQueryString(filters: ListOpportunitiesFilters = {}): string {
  const params = new URLSearchParams()
  if (filters.status) {
    params.set('status', Array.isArray(filters.status) ? filters.status.join(',') : filters.status)
  }
  if (filters.responsibleId) params.set('responsibleId', filters.responsibleId)
  if (filters.clientId) params.set('clientId', filters.clientId)
  if (filters.tenantId) params.set('tenantId', filters.tenantId)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const opportunitiesApi = {
  list: (filters: ListOpportunitiesFilters = {}) =>
    api
      .get<{ items: Opportunity[] }>(`/opportunities${buildQueryString(filters)}`)
      .then((response) => response.items),

  getById: (id: string) =>
    api
      .get<{ item: Opportunity }>(`/opportunities/${encodeURIComponent(id)}`)
      .then((response) => response.item),

  create: (input: CreateOpportunityInput) =>
    api
      .post<{ item: Opportunity }>('/opportunities', input)
      .then((response) => response.item),

  update: (id: string, input: UpdateOpportunityInput) =>
    api
      .patch<{ item: Opportunity }>(`/opportunities/${encodeURIComponent(id)}`, input)
      .then((response) => response.item),

  delete: (id: string) =>
    api.delete<void>(`/opportunities/${encodeURIComponent(id)}`),
}
