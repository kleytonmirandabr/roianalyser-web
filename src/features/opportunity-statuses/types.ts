export type OpportunityStatusCategory =
  | 'draft' | 'qualified' | 'in_progress' | 'gain' | 'loss' | 'cancelled'

export const CATEGORIES: OpportunityStatusCategory[] = [
  'draft', 'qualified', 'in_progress', 'gain', 'loss', 'cancelled',
]

export const CATEGORY_LABELS: Record<OpportunityStatusCategory, string> = {
  draft: 'Rascunho',
  qualified: 'Qualificada',
  in_progress: 'Em andamento',
  gain: 'Ganha',
  loss: 'Perdida',
  cancelled: 'Cancelada',
}

export interface OpportunityStatus {
  id: string
  tenantId: string
  key: string
  name: string
  color: string | null
  category: OpportunityStatusCategory | null
  displayOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateOpportunityStatusInput {
  key: string
  name: string
  color?: string | null
  category?: OpportunityStatusCategory | null
  displayOrder?: number
  active?: boolean
  tenantId?: string
}

export interface UpdateOpportunityStatusInput {
  name?: string
  color?: string | null
  category?: OpportunityStatusCategory | null
  displayOrder?: number
  active?: boolean
}
