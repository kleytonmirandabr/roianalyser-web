export type OpportunityDeletionReason = {
  id: string
  tenantId: string
  key: string
  name: string
  displayOrder: number
  active: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type CreateOpportunityDeletionReasonInput = {
  name: string
  key?: string
  displayOrder?: number
  active?: boolean
  tenantId?: string
}

export type UpdateOpportunityDeletionReasonInput = Partial<CreateOpportunityDeletionReasonInput>
