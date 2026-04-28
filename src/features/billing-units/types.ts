// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/billing-units.

export interface BillingUnit {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/billing-units no backend
  [k: string]: unknown
}
export interface CreateBillingUnitInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateBillingUnitInput {
  name?: string
  [k: string]: unknown
}
