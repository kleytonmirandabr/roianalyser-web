/**
 * Tipos do módulo Oportunidades — espelha o schema do backend
 * (`opportunities` table do Phase 0 + `routes/opportunity-routes.js`).
 *
 * Lifecycle: draft → qualified → proposal → negotiation → won / lost / cancelled
 *
 * Datas são ISO 8601 strings (regra: TIMESTAMP WITH TIME ZONE no banco
 * → string serializada). `expectedCloseDate` é DATE (yyyy-mm-dd).
 *
 * Spec: PLAN_split-domain-entities.md, seção 2.2.1.
 */

export type OpportunityStatus =
  | 'draft'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'cancelled'

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  'draft',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
  'cancelled',
]

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  draft: 'Rascunho',
  qualified: 'Qualificada',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  won: 'Ganha',
  lost: 'Perdida',
  cancelled: 'Cancelada',
}

export type Opportunity = {
  id: string
  tenantId: string
  clientId: string
  responsibleId: string
  name: string
  status: OpportunityStatus
  sourceKey: string | null
  estimatedValue: number | null
  currency: string
  expectedCloseDate: string | null  // yyyy-mm-dd
  description: string | null
  wonAt: string | null
  lostAt: string | null
  lostReasonKey: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deletedBy: string | null
}

export type CreateOpportunityInput = {
  name: string
  status?: OpportunityStatus
  clientId?: string
  responsibleId?: string
  sourceKey?: string | null
  estimatedValue?: number | null
  currency?: string
  expectedCloseDate?: string | null
  description?: string | null
  tenantId?: string  // só master pode setar
}

export type UpdateOpportunityInput = Partial<
  Pick<
    Opportunity,
    | 'name'
    | 'status'
    | 'clientId'
    | 'responsibleId'
    | 'sourceKey'
    | 'estimatedValue'
    | 'currency'
    | 'expectedCloseDate'
    | 'description'
    | 'lostReasonKey'
  >
>

export type ListOpportunitiesFilters = {
  status?: OpportunityStatus | OpportunityStatus[]
  responsibleId?: string
  clientId?: string
  tenantId?: string  // só master
}
