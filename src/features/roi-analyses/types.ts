/**
 * Tipos de ROI Analysis (Sprint 5 — análise pré-venda versionada por oportunidade).
 * Lifecycle: draft → submitted → approved/rejected → archived.
 */

export type RoiStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived'

export const ROI_STATUSES: RoiStatus[] = [
  'draft', 'submitted', 'approved', 'rejected', 'archived',
]

export const ROI_STATUS_LABELS: Record<RoiStatus, string> = {
  draft: 'Rascunho',
  submitted: 'Submetido',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  archived: 'Arquivado',
}

export type FlowType = 'inflow' | 'outflow'

export const FLOW_TYPE_LABELS: Record<FlowType, string> = {
  inflow: 'Receita',
  outflow: 'Custo',
}

export type RoiAnalysis = {
  id: string
  tenantId: string
  opportunityId: string
  name: string
  version: number
  isBaseline: boolean
  status: RoiStatus
  discountRate: number | null
  durationMonths: number | null
  currency: string
  totalRevenue: number | null
  totalCost: number | null
  netValue: number | null
  npv: number | null
  irr: number | null
  paybackMonths: number | null
  approvedBy: string | null
  approvedAt: string | null
  rejectedReason: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type RoiEntry = {
  id: string
  roiAnalysisId: string
  period: string
  categoryKey: string
  description: string | null
  amount: number
  flowType: FlowType
  recurrence: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type CreateRoiInput = {
  opportunityId: string
  name?: string
  version?: number
  isBaseline?: boolean
  status?: RoiStatus
  discountRate?: number | null
  durationMonths?: number | null
  currency?: string
  notes?: string | null
}

export type UpdateRoiInput = Partial<
  Pick<RoiAnalysis,
    | 'name' | 'notes' | 'isBaseline' | 'status' | 'rejectedReason'
    | 'discountRate' | 'durationMonths' | 'currency'
  >
>

export type CreateRoiEntryInput = {
  period: string
  categoryKey: string
  amount: number
  flowType: FlowType
  description?: string | null
  recurrence?: string | null
  notes?: string | null
}

export type UpdateRoiEntryInput = Partial<CreateRoiEntryInput>
