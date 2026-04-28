import { api } from '@/shared/api/client'
import type { CreateBillingUnitInput, BillingUnit, UpdateBillingUnitInput } from './types'

export const billingUnitsApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: BillingUnit[] }>(`/billing-units${qs}`).then(r => r.items)
  },
  create: (input: CreateBillingUnitInput) =>
    api.post<{ item: BillingUnit }>('/billing-units', input).then(r => r.item),
  update: (id: string, input: UpdateBillingUnitInput) =>
    api.patch<{ item: BillingUnit }>(`/billing-units/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/billing-units/${encodeURIComponent(id)}`),
}
