/**
 * Tipos de Contrato (NOVO — Sprint 3, schema do Phase 0).
 *
 * Lifecycle: drafting → pending_signature → active → ending_soon → ended
 *                                                  ↘ terminated
 *                                                  ↘ renewed
 *
 * Path features/contracts2/ pra evitar conflito com features/projects
 * (que mapeia o backend legacy /api/contracts → contracts_legacy).
 *
 * Spec: PLAN_split-domain-entities.md, seção 2.2.4.
 */

export type ContractStatus =
  | 'drafting'
  | 'pending_signature'
  | 'active'
  | 'ending_soon'
  | 'ended'
  | 'terminated'
  | 'renewed'

export const CONTRACT_STATUSES: ContractStatus[] = [
  'drafting',
  'pending_signature',
  'active',
  'ending_soon',
  'ended',
  'terminated',
  'renewed',
]

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  drafting: 'Em elaboração',
  pending_signature: 'Aguardando assinatura',
  active: 'Vigente',
  ending_soon: 'Encerrando',
  ended: 'Encerrado',
  terminated: 'Cancelado',
  renewed: 'Renovado',
}

export type RenewalType = 'auto' | 'manual' | 'none'

export const RENEWAL_TYPE_LABELS: Record<RenewalType, string> = {
  auto: 'Automática',
  manual: 'Manual',
  none: 'Sem renovação',
}

export type Contract = {
  id: string
  tenantId: string
  opportunityId: string | null
  clientId: string
  responsibleId: string
  approvedRoiId: string | null
  contractNumber: string
  name: string
  status: ContractStatus
  contractTypeKey: string | null
  totalValue: number
  currency: string
  startDate: string | null
  endDate: string | null
  signedDate: string | null
  renewalType: RenewalType
  noticePeriodDays: number
  paymentTerms: string | null
  previousContractId: string | null
  terminatedAt: string | null
  terminatedReason: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deletedBy: string | null
}

export type CreateContractInput = {
  name: string
  totalValue: number
  status?: ContractStatus
  opportunityId?: string | null
  clientId?: string
  responsibleId?: string
  approvedRoiId?: string | null
  contractNumber?: string  // auto-gerado pelo backend se omitido (CT-YYYY-NNN)
  contractTypeKey?: string | null
  currency?: string
  startDate?: string | null
  endDate?: string | null
  signedDate?: string | null
  renewalType?: RenewalType
  noticePeriodDays?: number
  paymentTerms?: string | null
  previousContractId?: string | null
  tenantId?: string  // só master
}

export type UpdateContractInput = Partial<
  Pick<
    Contract,
    | 'name'
    | 'status'
    | 'clientId'
    | 'responsibleId'
    | 'contractTypeKey'
    | 'totalValue'
    | 'currency'
    | 'startDate'
    | 'endDate'
    | 'signedDate'
    | 'renewalType'
    | 'noticePeriodDays'
    | 'paymentTerms'
    | 'terminatedReason'
  >
>

export type ListContractsFilters = {
  status?: ContractStatus | ContractStatus[]
  opportunityId?: string
  clientId?: string
  responsibleId?: string
  tenantId?: string
}
