import { useQuery } from '@tanstack/react-query'

import { contractsApi } from '../api'

export function useContract(id: string | undefined | null) {
  return useQuery({
    queryKey: ['contracts2', 'detail', id],
    queryFn: () => contractsApi.getById(id as string),
    enabled: Boolean(id),
  })
}
