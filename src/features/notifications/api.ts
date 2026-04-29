import { api } from '@/shared/api/client'
import type { NotificationPrefs, NotificationsListResponse } from './api-types'

export const notificationsApi = {
  list: (onlyUnread = false) =>
    api.get<NotificationsListResponse>(`/notifications${onlyUnread ? '?unread=1' : ''}`),
  markRead: (id: string) =>
    api.patch<{ ok: true }>(`/notifications/${encodeURIComponent(id)}/read`),
  readAll: () =>
    api.post<{ ok: true }>(`/notifications/read-all`),
  getPrefs: () =>
    api.get<NotificationPrefs>('/me/notifications-prefs'),
  updatePrefs: (patch: Partial<NotificationPrefs>) =>
    api.patch<{ ok: true }>('/me/notifications-prefs', patch),
}
