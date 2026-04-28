import { api } from '@/shared/api/client'
import type { CreateCatalogItemInput, CatalogItem, UpdateCatalogItemInput } from './types'

export const catalogItemsApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: CatalogItem[] }>(`/catalog-items${qs}`).then(r => r.items)
  },
  create: (input: CreateCatalogItemInput) =>
    api.post<{ item: CatalogItem }>('/catalog-items', input).then(r => r.item),
  update: (id: string, input: UpdateCatalogItemInput) =>
    api.patch<{ item: CatalogItem }>(`/catalog-items/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/catalog-items/${encodeURIComponent(id)}`),
}
