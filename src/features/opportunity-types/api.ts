import { api } from '@/shared/api/client'
import type {
  CreateOpportunityTypeInput, OpportunityType, UpdateOpportunityTypeInput,
} from './types'

export const opportunityTypesApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: OpportunityType[] }>(`/opportunity-types${qs}`).then(r => r.items)
  },
  create: (input: CreateOpportunityTypeInput) =>
    api.post<{ item: OpportunityType }>('/opportunity-types', input).then(r => r.item),
  update: (id: string, input: UpdateOpportunityTypeInput) =>
    api.patch<{ item: OpportunityType }>(`/opportunity-types/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/opportunity-types/${encodeURIComponent(id)}`),
}
