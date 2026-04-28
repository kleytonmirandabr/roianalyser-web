import { api } from '@/shared/api/client'
import type { CreateItemCategoryInput, ItemCategory, UpdateItemCategoryInput } from './types'

export const itemCategoriesApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: ItemCategory[] }>(`/item-categories${qs}`).then(r => r.items)
  },
  create: (input: CreateItemCategoryInput) =>
    api.post<{ item: ItemCategory }>('/item-categories', input).then(r => r.item),
  update: (id: string, input: UpdateItemCategoryInput) =>
    api.patch<{ item: ItemCategory }>(`/item-categories/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/item-categories/${encodeURIComponent(id)}`),
}
