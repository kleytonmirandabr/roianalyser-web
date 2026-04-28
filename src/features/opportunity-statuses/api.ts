import { api } from '@/shared/api/client'
import type {
  CreateOpportunityStatusInput, OpportunityStatus, UpdateOpportunityStatusInput,
} from './types'

export const opportunityStatusesApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: OpportunityStatus[] }>(`/opportunity-statuses${qs}`).then(r => r.items)
  },
  create: (input: CreateOpportunityStatusInput) =>
    api.post<{ item: OpportunityStatus }>('/opportunity-statuses', input).then(r => r.item),
  update: (id: string, input: UpdateOpportunityStatusInput) =>
    api.patch<{ item: OpportunityStatus }>(`/opportunity-statuses/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/opportunity-statuses/${encodeURIComponent(id)}`),
}
