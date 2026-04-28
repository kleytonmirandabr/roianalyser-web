import { useQuery } from '@tanstack/react-query'

import { opportunitiesApi } from '../api'

export function useOpportunity(id: string | undefined | null) {
  return useQuery({
    queryKey: ['opportunities', 'detail', id],
    queryFn: () => opportunitiesApi.getById(id as string),
    enabled: Boolean(id),
  })
}
