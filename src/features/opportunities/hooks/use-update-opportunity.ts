import { useMutation, useQueryClient } from '@tanstack/react-query'

import { opportunitiesApi } from '../api'
import type { Opportunity, UpdateOpportunityInput } from '../types'

export function useUpdateOpportunity(id: string | undefined | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOpportunityInput) =>
      opportunitiesApi.update(id as string, input),
    onSuccess: (item: Opportunity) => {
      queryClient.setQueryData(['opportunities', 'detail', id], item)
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] })
    },
  })
}
