import { api } from '@/shared/api/client'
import type { CreateSectorInput, Sector, UpdateSectorInput } from './types'

export const sectorsApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: Sector[] }>(`/sectors${qs}`).then(r => r.items)
  },
  create: (input: CreateSectorInput) =>
    api.post<{ item: Sector }>('/sectors', input).then(r => r.item),
  update: (id: string, input: UpdateSectorInput) =>
    api.patch<{ item: Sector }>(`/sectors/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/sectors/${encodeURIComponent(id)}`),
}
