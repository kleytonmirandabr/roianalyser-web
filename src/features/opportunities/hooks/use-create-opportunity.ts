import { useMutation, useQueryClient } from '@tanstack/react-query'

import { opportunitiesApi } from '../api'
import type { CreateOpportunityInput } from '../types'

export function useCreateOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOpportunityInput) => opportunitiesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] })
    },
  })
}
