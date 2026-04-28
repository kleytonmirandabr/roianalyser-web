import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contactsApi } from '../api'
import type { CreateContactInput, UpdateContactInput } from '../types'

export function useContacts(tenantId?: string) {
  return useQuery({
    queryKey: ['contacts', 'list', tenantId ?? null],
    queryFn: () => contactsApi.list(tenantId),
  })
}
export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateContactInput) => contactsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', 'list'] }),
  })
}
export function useUpdateContact(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateContactInput) => contactsApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', 'list'] }),
  })
}
export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', 'list'] }),
  })
}
