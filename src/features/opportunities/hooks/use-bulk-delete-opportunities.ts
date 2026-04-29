import { useMutation, useQueryClient } from '@tanstack/react-query'

import { opportunitiesApi } from '../api'

type BulkInput = { ids: string[]; reasonId: string; note?: string | null }

export function useBulkDeleteOpportunities() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkInput) => opportunitiesApi.bulkDelete(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] })
    },
  })
}
