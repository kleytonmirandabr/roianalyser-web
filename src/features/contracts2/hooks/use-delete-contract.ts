import { useMutation, useQueryClient } from '@tanstack/react-query'

import { contractsApi } from '../api'

export function useDeleteContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contractsApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['contracts2', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['contracts2', 'detail', id] })
    },
  })
}
