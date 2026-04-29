import { useQuery } from '@tanstack/react-query'
import { emailLogApi } from '../api'
import type { EmailLogFilters } from '../types'

export function useEmailLog(filters?: EmailLogFilters) {
  return useQuery({
    queryKey: ['email-log', filters ?? null],
    queryFn: () => emailLogApi.list(filters),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}
