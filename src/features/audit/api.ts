import { api } from '@/shared/api/client'

import type { AuditEvent } from './types'

export type AuditQuery = {
  limit?: number
  offset?: number
  clientId?: string
}

export const auditApi = {
  list: (params: AuditQuery = {}) => {
    const search = new URLSearchParams()
    if (params.limit) search.set('limit', String(params.limit))
    if (params.offset) search.set('offset', String(params.offset))
    if (params.clientId) search.set('clientId', params.clientId)
    const qs = search.toString()
    const path = qs ? `/audit-log?${qs}` : '/audit-log'
    return api
      .get<{ items: AuditEvent[] }>(path)
      .then((response) => response.items ?? [])
  },
}
