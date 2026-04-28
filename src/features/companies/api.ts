import { api } from '@/shared/api/client'
import type { CreateCompanyInput, Company, UpdateCompanyInput } from './types'

export const companiesApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: Company[] }>(`/companies${qs}`).then(r => r.items)
  },
  create: (input: CreateCompanyInput) =>
    api.post<{ item: Company }>('/companies', input).then(r => r.item),
  update: (id: string, input: UpdateCompanyInput) =>
    api.patch<{ item: Company }>(`/companies/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/companies/${encodeURIComponent(id)}`),
}
