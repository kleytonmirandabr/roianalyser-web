import { useMutation, useQueryClient } from '@tanstack/react-query'

import { contractsApi } from '../api'
import type { CreateContractInput } from '../types'

export function useCreateContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateContractInput) => contractsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts2', 'list'] })
    },
  })
}
