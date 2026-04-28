import { api } from '@/shared/api/client'
import type { CreateUserGroupInput, UserGroup, UpdateUserGroupInput } from './types'

export const userGroupsApi = {
  list: (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return api.get<{ items: UserGroup[] }>(`/user-groups${qs}`).then(r => r.items)
  },
  create: (input: CreateUserGroupInput) =>
    api.post<{ item: UserGroup }>('/user-groups', input).then(r => r.item),
  update: (id: string, input: UpdateUserGroupInput) =>
    api.patch<{ item: UserGroup }>(`/user-groups/${encodeURIComponent(id)}`, input).then(r => r.item),
  delete: (id: string) =>
    api.delete<void>(`/user-groups/${encodeURIComponent(id)}`),
}
