/**
 * Tipos de Forecast (Sprint 4 — previsão financeira versionada por projeto).
 * Lifecycle: draft → submitted → approved/rejected → archived.
 */

export type ForecastStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived'

export const FORECAST_STATUSES: ForecastStatus[] = [
  'draft', 'submitted', 'approved', 'rejected', 'archived',
]

export const FORECAST_STATUS_LABELS: Record<ForecastStatus, string> = {
  draft: 'Rascunho',
  submitted: 'Submetido',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  archived: 'Arquivado',
}

export type Forecast = {
  id: string
  tenantId: string
  projectId: string
  name: string
  version: number
  isBaseline: boolean
  status: ForecastStatus
  fromRoiAnalysisId: string | null
  approvedBy: string | null
  approvedAt: string | null
  rejectedReason: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ForecastEntry = {
  id: string
  forecastId: string
  period: string  // yyyy-mm-dd (sempre dia 1 do mês)
  categoryKey: string
  description: string | null
  expected: number
  actual: number | null
  paidStatus: 'pending' | 'partial' | 'paid'
  paidAt: string | null
  attachmentUrl: string | null
  createdAt: string
  updatedAt: string
}

export type CreateForecastInput = {
  projectId: string
  name?: string
  version?: number  // auto-incremento se omitido
  isBaseline?: boolean
  status?: ForecastStatus
  fromRoiAnalysisId?: string | null
  notes?: string | null
}

export type UpdateForecastInput = Partial<
  Pick<Forecast, 'name' | 'notes' | 'isBaseline' | 'status' | 'rejectedReason'>
>

export type CreateForecastEntryInput = {
  period: string
  categoryKey: string
  expected: number
  description?: string | null
  actual?: number | null
  paidStatus?: 'pending' | 'partial' | 'paid'
  paidAt?: string | null
  attachmentUrl?: string | null
}

export type UpdateForecastEntryInput = Partial<CreateForecastEntryInput>
