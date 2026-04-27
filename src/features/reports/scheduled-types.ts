/** Espelha o shape do `/api/scheduled-reports` (scheduled-report-routes.js). */

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'
export type ScheduleFormat = 'html' | 'pdf'

export type ScheduledReport = {
  id: string
  reportId: string
  clientId?: string | null
  createdBy?: string
  name: string
  frequency: ScheduleFrequency
  /** 0–6, usado quando frequency='weekly'. */
  dayOfWeek: number
  /** 1–31, usado quando frequency='monthly'. */
  dayOfMonth: number
  /** 0–23. */
  hour: number
  timezone: string
  /** Lista de e-mails separada por vírgula. */
  recipients: string
  format: ScheduleFormat
  enabled: boolean
  lastSentAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type CreateScheduledReportInput = {
  reportId: string
  name: string
  frequency: ScheduleFrequency
  dayOfWeek?: number
  dayOfMonth?: number
  hour: number
  timezone?: string
  recipients: string
  format?: ScheduleFormat
  enabled?: boolean
}

export type UpdateScheduledReportInput = Partial<CreateScheduledReportInput>
