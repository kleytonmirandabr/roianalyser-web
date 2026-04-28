import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userGroupsApi } from '../api'
import type { CreateUserGroupInput, UpdateUserGroupInput } from '../types'

export function useUserGroups(tenantId?: string) {
  return useQuery({
    queryKey: ['user-groups', 'list', tenantId ?? null],
    queryFn: () => userGroupsApi.list(tenantId),
  })
}
export function useCreateUserGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserGroupInput) => userGroupsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-groups', 'list'] }),
  })
}
export function useUpdateUserGroup(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateUserGroupInput) => userGroupsApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-groups', 'list'] }),
  })
}
export function useDeleteUserGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => userGroupsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-groups', 'list'] }),
  })
}
