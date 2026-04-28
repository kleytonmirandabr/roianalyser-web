import { useMutation, useQueryClient } from '@tanstack/react-query'

import { contractsApi } from '../api'
import type { Contract, UpdateContractInput } from '../types'

export function useUpdateContract(id: string | undefined | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateContractInput) =>
      contractsApi.update(id as string, input),
    onSuccess: (item: Contract) => {
      queryClient.setQueryData(['contracts2', 'detail', id], item)
      queryClient.invalidateQueries({ queryKey: ['contracts2', 'list'] })
    },
  })
}
