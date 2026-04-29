import { useMutation, useQueryClient } from '@tanstack/react-query'

import { opportunitiesApi } from '../api'

type DeleteInput = { id: string; reasonId: string; note?: string | null }

export function useDeleteOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reasonId, note }: DeleteInput) =>
      opportunitiesApi.delete(id, { reasonId, note }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'detail', vars.id] })
    },
  })
}
