import { useMutation, useQueryClient } from '@tanstack/react-query'

import { opportunitiesApi } from '../api'

export function useDeleteOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => opportunitiesApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'detail', id] })
    },
  })
}
