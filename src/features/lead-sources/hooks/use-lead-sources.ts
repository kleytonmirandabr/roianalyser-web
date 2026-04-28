import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { leadSourcesApi } from '../api'
import type { CreateLeadSourceInput, UpdateLeadSourceInput } from '../types'

export function useLeadSources(tenantId?: string) {
  return useQuery({
    queryKey: ['lead-sources', 'list', tenantId ?? null],
    queryFn: () => leadSourcesApi.list(tenantId),
  })
}
export function useCreateLeadSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeadSourceInput) => leadSourcesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-sources', 'list'] }),
  })
}
export function useUpdateLeadSource(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateLeadSourceInput) => leadSourcesApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-sources', 'list'] }),
  })
}
export function useDeleteLeadSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leadSourcesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-sources', 'list'] }),
  })
}
