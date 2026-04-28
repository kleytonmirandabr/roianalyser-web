import { api } from '@/shared/api/client'

import type {
  Contract,
  CreateContractInput,
  ListContractsFilters,
  UpdateContractInput,
} from './types'

function buildQueryString(filters: ListContractsFilters = {}): string {
  const params = new URLSearchParams()
  if (filters.status) {
    params.set('status', Array.isArray(filters.status) ? filters.status.join(',') : filters.status)
  }
  if (filters.opportunityId) params.set('opportunityId', filters.opportunityId)
  if (filters.clientId) params.set('clientId', filters.clientId)
  if (filters.responsibleId) params.set('responsibleId', filters.responsibleId)
  if (filters.tenantId) params.set('tenantId', filters.tenantId)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const contractsApi = {
  list: (filters: ListContractsFilters = {}) =>
    api
      .get<{ items: Contract[] }>(`/contracts2${buildQueryString(filters)}`)
      .then((response) => response.items),

  getById: (id: string) =>
    api
      .get<{ item: Contract }>(`/contracts2/${encodeURIComponent(id)}`)
      .then((response) => response.item),

  create: (input: CreateContractInput) =>
    api
      .post<{ item: Contract }>('/contracts2', input)
      .then((response) => response.item),

  update: (id: string, input: UpdateContractInput) =>
    api
      .patch<{ item: Contract }>(`/contracts2/${encodeURIComponent(id)}`, input)
      .then((response) => response.item),

  delete: (id: string) =>
    api.delete<void>(`/contracts2/${encodeURIComponent(id)}`),
}
