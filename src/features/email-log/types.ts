export interface EmailLogItem {
  id: string
  taskId: string
  kind: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  taskTitle: string | null
  taskEntityType: string | null
  taskEntityId: string | null
  tenantId: string
  tenantName: string | null
  channel: string
  status: 'sent' | 'failed' | string
  error: string | null
  sentAt: string
  icsSequence: number
}

export interface EmailLogStats {
  total24h: number
  failed1h: number
  failed24h: number
}

export interface EmailLogFilters {
  kind?: string
  status?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
  tenantId?: string
  limit?: number
  offset?: number
}

export interface EmailLogResponse {
  items: EmailLogItem[]
  total: number
  stats: EmailLogStats
}
