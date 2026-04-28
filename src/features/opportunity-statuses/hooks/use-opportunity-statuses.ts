import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { opportunityStatusesApi } from '../api'
import type {
  CreateOpportunityStatusInput, UpdateOpportunityStatusInput,
} from '../types'

export function useOpportunityStatuses(tenantId?: string) {
  return useQuery({
    queryKey: ['opportunity-statuses', 'list', tenantId ?? null],
    queryFn: () => opportunityStatusesApi.list(tenantId),
  })
}

export function useCreateOpportunityStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOpportunityStatusInput) => opportunityStatusesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunity-statuses', 'list'] }),
  })
}
export function useUpdateOpportunityStatus(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOpportunityStatusInput) =>
      opportunityStatusesApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunity-statuses', 'list'] }),
  })
}
export function useDeleteOpportunityStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => opportunityStatusesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunity-statuses', 'list'] }),
  })
}
