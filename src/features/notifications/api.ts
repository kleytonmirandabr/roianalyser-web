import { api } from '@/shared/api/client'
import type {
  NotificationPrefs, NotificationsListResponse, SnoozeRequest,
} from './api-types'

export interface ListNotificationsParams {
  cursor?: string | null
  onlyUnread?: boolean
  includeSnoozed?: boolean
  limit?: number
}

function buildQs(params: ListNotificationsParams): string {
  const q = new URLSearchParams()
  if (params.cursor) q.set('cursor', params.cursor)
  if (params.onlyUnread) q.set('unread', '1')
  if (params.includeSnoozed) q.set('includeSnoozed', '1')
  if (params.limit) q.set('limit', String(params.limit))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const notificationsApi = {
  list: (params: ListNotificationsParams = {}) =>
    api.get<NotificationsListResponse>(`/notifications${buildQs(params)}`),
  markRead: (id: string) =>
    api.patch<{ ok: true }>(`/notifications/${encodeURIComponent(id)}/read`),
  readAll: () =>
    api.post<{ ok: true }>(`/notifications/read-all`),
  snooze: (id: string, body: SnoozeRequest) =>
    api.patch<{ ok: true; snoozedUntil: string }>(`/notifications/${encodeURIComponent(id)}/snooze`, body),
  unsnooze: (id: string) =>
    api.patch<{ ok: true }>(`/notifications/${encodeURIComponent(id)}/unsnooze`),
  getPrefs: () =>
    api.get<NotificationPrefs>('/me/notifications-prefs'),
  updatePrefs: (patch: Partial<NotificationPrefs>) =>
    api.patch<{ ok: true }>('/me/notifications-prefs', patch),
}
