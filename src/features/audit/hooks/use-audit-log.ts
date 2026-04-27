import { useQuery } from '@tanstack/react-query'

import { auditApi, type AuditQuery } from '../api'

export function useAuditLog(params: AuditQuery = {}) {
  return useQuery({
    queryKey: ['audit-log', params],
    queryFn: () => auditApi.list(params),
    staleTime: 30_000,
  })
}
