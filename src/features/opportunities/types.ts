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

// Status agora é FK pro catálogo opportunity_statuses (ver useOpportunityStatuses).
// Mantemos o type alias só pra compatibilidade — é apenas string.
export type OpportunityStatusId = string

export type Opportunity = {
  id: string
  tenantId: string
  clientId: string
  responsibleId: string
  name: string
  statusId: string | null
  opportunityTypeId: string | null
  sourceKey: string | null
  estimatedValue: number | null
  currency: string
  expectedCloseDate: string | null  // yyyy-mm-dd
  description: string | null
  companyId: string | null
  leadSourceId: string | null
  probability: number | null
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
  statusId?: string | null
  opportunityTypeId?: string | null
  clientId?: string
  responsibleId?: string
  sourceKey?: string | null
  estimatedValue?: number | null
  currency?: string
  expectedCloseDate?: string | null
  description?: string | null
  companyId?: string | null
  leadSourceId?: string | null
  probability?: number | null
  tenantId?: string  // só master pode setar
}

export type UpdateOpportunityInput = Partial<
  Pick<
    Opportunity,
    | 'name'
    | 'statusId'
    | 'opportunityTypeId'
    | 'companyId'
    | 'leadSourceId'
    | 'probability'
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
  statusId?: string
  opportunityTypeId?: string
  responsibleId?: string
  clientId?: string
  tenantId?: string  // só master
}
