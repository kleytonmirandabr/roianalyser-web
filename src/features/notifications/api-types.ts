export interface ServerNotification {
  id: string
  kind: string
  title: string
  body: string | null
  link: string | null
  entityType: string | null
  entityId: string | null
  readAt: string | null
  snoozedUntil: string | null
  createdAt: string
}

export interface NotificationPrefs {
  notifyTaskCreated: boolean
  notifyTaskOverdue: boolean
  notifyTaskReminder: boolean
  notifyDigestMorning: boolean
}

export interface NotificationsListResponse {
  items: ServerNotification[]
  unreadCount: number
  nextCursor: string | null
}

export interface SnoozeRequest {
  minutes?: number
  until?: string
}
