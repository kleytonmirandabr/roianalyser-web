/**
 * Tipos de ROI Analysis (Sprint 5 + #236).
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

/* ──────── Comportamento (Sprint #231 + #235) ──────── */

export type Comportamento =
  | 'INCOME_ONE_TIME'  | 'INCOME_MONTHLY'  | 'INCOME_INSTALLMENT'
  | 'EXPENSE_ONE_TIME' | 'EXPENSE_MONTHLY' | 'EXPENSE_INSTALLMENT'
  | 'INVESTMENT_ONE_TIME' | 'INVESTMENT_INSTALLMENT'

export const COMPORTAMENTOS: Comportamento[] = [
  'INCOME_ONE_TIME', 'INCOME_MONTHLY', 'INCOME_INSTALLMENT',
  'EXPENSE_ONE_TIME', 'EXPENSE_MONTHLY', 'EXPENSE_INSTALLMENT',
  'INVESTMENT_ONE_TIME', 'INVESTMENT_INSTALLMENT',
]

export type ComportamentoFamily = 'INCOME' | 'EXPENSE' | 'INVESTMENT'
export type ComportamentoSuffix = 'ONE_TIME' | 'MONTHLY' | 'INSTALLMENT'

export function familyOf(c: Comportamento | string | null | undefined): ComportamentoFamily | null {
  const s = String(c || '')
  if (s.startsWith('INCOME_'))     return 'INCOME'
  if (s.startsWith('EXPENSE_'))    return 'EXPENSE'
  if (s.startsWith('INVESTMENT_')) return 'INVESTMENT'
  return null
}

export function suffixOf(c: Comportamento | string | null | undefined): ComportamentoSuffix | null {
  const s = String(c || '')
  if (s.endsWith('_ONE_TIME'))    return 'ONE_TIME'
  if (s.endsWith('_MONTHLY'))     return 'MONTHLY'
  if (s.endsWith('_INSTALLMENT')) return 'INSTALLMENT'
  return null
}

/* ──────── Legado (preservado pra retro-compat) ──────── */

export type FlowType = 'inflow' | 'outflow'

export const FLOW_TYPE_LABELS: Record<FlowType, string> = {
  inflow: 'Receita',
  outflow: 'Custo',
}

/* ──────── Entidades ──────── */

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
  // Modelo novo (Sprint #236)
  catalogItemId: string | null
  categoryId: string | null
  comportamento: Comportamento | null
  quantity: number | null
  unitValue: number | null
  discountPct: number | null
  startMonth: number | null
  installments: number | null
  // Modelo legado
  period: string | null
  categoryKey: string | null
  description: string | null
  amount: number | null
  flowType: FlowType | null
  recurrence: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/* ──────── Métricas computadas (retornadas pelo GET /:id) ──────── */

export type MonthlyFlow = {
  month: number
  inflow: number
  outflow: number
  investment: number
  net: number
  cumulative: number
}

export type CategorySummary = {
  categoryId: string | null
  categoryKey: string | null
  total: number
  count: number
}

export type ComportamentoSummary = {
  comportamento: Comportamento
  total: number
  count: number
}

export type RoiMetrics = {
  totalRevenue: number
  totalCost: number
  totalInvestment: number
  netValue: number
  npv: number
  irr: number | null
  paybackMonths: number | null
  monthlyFlow: MonthlyFlow[]
  summary: {
    byCategory: CategorySummary[]
    byComportamento: ComportamentoSummary[]
  }
  recurringRevenueAvg: number
  discountStats: {
    grossRevenue: number
    netRevenue: number
    discountAmount: number
  }
}

/* ──────── Inputs ──────── */

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

/** Shape NOVA — preferida pelo backend Sprint #236+ */
export type CreateRoiEntryInputV2 = {
  catalogItemId?: string | null
  categoryId?: string | null
  comportamento: Comportamento
  quantity: number
  unitValue: number
  discountPct?: number | null
  startMonth?: number | null
  installments?: number | null
  description?: string | null
  notes?: string | null
}

/** Shape LEGADA — mantida pra retro-compat */
export type CreateRoiEntryInputLegacy = {
  period: string
  categoryKey: string
  amount: number
  flowType: FlowType
  description?: string | null
  recurrence?: string | null
  notes?: string | null
}

export type CreateRoiEntryInput = CreateRoiEntryInputV2 | CreateRoiEntryInputLegacy

export type UpdateRoiEntryInput = Partial<CreateRoiEntryInputV2> & Partial<CreateRoiEntryInputLegacy>
