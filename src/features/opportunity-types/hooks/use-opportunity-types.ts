import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { opportunityTypesApi } from '../api'
import type { CreateOpportunityTypeInput, UpdateOpportunityTypeInput } from '../types'

export function useOpportunityTypes(tenantId?: string) {
  return useQuery({
    queryKey: ['opportunity-types', 'list', tenantId ?? null],
    queryFn: () => opportunityTypesApi.list(tenantId),
  })
}
export function useCreateOpportunityType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOpportunityTypeInput) => opportunityTypesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunity-types', 'list'] }),
  })
}
export function useUpdateOpportunityType(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOpportunityTypeInput) =>
      opportunityTypesApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunity-types', 'list'] }),
  })
}
export function useDeleteOpportunityType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => opportunityTypesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunity-types', 'list'] }),
  })
}
