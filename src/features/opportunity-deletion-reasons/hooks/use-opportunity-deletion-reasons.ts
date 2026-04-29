import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { opportunityDeletionReasonsApi } from '../api'
import type {
  CreateOpportunityDeletionReasonInput,
  UpdateOpportunityDeletionReasonInput,
} from '../types'

const KEY = ['opportunity-deletion-reasons', 'list']

export function useOpportunityDeletionReasons() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => opportunityDeletionReasonsApi.list(),
  })
}

export function useCreateOpportunityDeletionReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOpportunityDeletionReasonInput) =>
      opportunityDeletionReasonsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateOpportunityDeletionReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOpportunityDeletionReasonInput }) =>
      opportunityDeletionReasonsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteOpportunityDeletionReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => opportunityDeletionReasonsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
