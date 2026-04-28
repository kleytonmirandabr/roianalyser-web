import { api } from '@/shared/api/client'
import type { CreateSalesGoalInput, SalesGoal, UpdateSalesGoalInput } from './types'

export const salesGoalsApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: SalesGoal[] }>(`/sales-goals${qs}`).then(r => r.items)
  },
  create: (input: CreateSalesGoalInput) =>
    api.post<{ item: SalesGoal }>('/sales-goals', input).then(r => r.item),
  update: (id: string, input: UpdateSalesGoalInput) =>
    api.patch<{ item: SalesGoal }>(`/sales-goals/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/sales-goals/${encodeURIComponent(id)}`),
}
