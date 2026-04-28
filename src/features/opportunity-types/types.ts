export interface OpportunityType {
  id: string
  tenantId: string
  key: string
  name: string
  description: string | null
  displayOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}
export interface CreateOpportunityTypeInput {
  key: string; name: string; description?: string | null;
  displayOrder?: number; active?: boolean; tenantId?: string;
}
export interface UpdateOpportunityTypeInput {
  name?: string; description?: string | null;
  displayOrder?: number; active?: boolean;
}
