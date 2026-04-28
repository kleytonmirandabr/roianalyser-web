import { useQuery } from '@tanstack/react-query'

import { contractsApi } from '../api'
import type { ListContractsFilters } from '../types'

export function useContracts(filters: ListContractsFilters = {}) {
  return useQuery({
    queryKey: ['contracts2', 'list', filters],
    queryFn: () => contractsApi.list(filters),
  })
}
