import { api } from '@/shared/api/client'
import type { CreateContactInput, Contact, UpdateContactInput } from './types'

export const contactsApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: Contact[] }>(`/contacts${qs}`).then(r => r.items)
  },
  create: (input: CreateContactInput) =>
    api.post<{ item: Contact }>('/contacts', input).then(r => r.item),
  update: (id: string, input: UpdateContactInput) =>
    api.patch<{ item: Contact }>(`/contacts/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/contacts/${encodeURIComponent(id)}`),
}
