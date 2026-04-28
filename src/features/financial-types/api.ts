import { api } from '@/shared/api/client'
import type { CreateFinancialTypeInput, FinancialType, UpdateFinancialTypeInput } from './types'

export const financialTypesApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: FinancialType[] }>(`/financial-types${qs}`).then(r => r.items)
  },
  create: (input: CreateFinancialTypeInput) =>
    api.post<{ item: FinancialType }>('/financial-types', input).then(r => r.item),
  update: (id: string, input: UpdateFinancialTypeInput) =>
    api.patch<{ item: FinancialType }>(`/financial-types/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/financial-types/${encodeURIComponent(id)}`),
}
