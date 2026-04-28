import { api } from '@/shared/api/client'
import type { CreateLeadSourceInput, LeadSource, UpdateLeadSourceInput } from './types'

export const leadSourcesApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: LeadSource[] }>(`/lead-sources${qs}`).then(r => r.items)
  },
  create: (input: CreateLeadSourceInput) =>
    api.post<{ item: LeadSource }>('/lead-sources', input).then(r => r.item),
  update: (id: string, input: UpdateLeadSourceInput) =>
    api.patch<{ item: LeadSource }>(`/lead-sources/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/lead-sources/${encodeURIComponent(id)}`),
}
