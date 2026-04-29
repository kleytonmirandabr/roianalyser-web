import { api } from '@/shared/api/client'
import type { EmailLogFilters, EmailLogResponse } from './types'

function buildQuery(f?: EmailLogFilters): string {
  if (!f) return ''
  const q = new URLSearchParams()
  if (f.kind) q.set('kind', f.kind)
  if (f.status) q.set('status', f.status)
  if (f.userId) q.set('userId', String(f.userId))
  if (f.dateFrom) q.set('dateFrom', f.dateFrom)
  if (f.dateTo) q.set('dateTo', f.dateTo)
  if (f.tenantId) q.set('tenantId', String(f.tenantId))
  if (f.limit) q.set('limit', String(f.limit))
  if (f.offset) q.set('offset', String(f.offset))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const emailLogApi = {
  list: (filters?: EmailLogFilters) =>
    api.get<EmailLogResponse>(`/notifications/email-log${buildQuery(filters)}`),
}
