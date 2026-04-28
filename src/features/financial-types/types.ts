// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/financial-types.

export interface FinancialType {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/financial-types no backend
  [k: string]: unknown
}
export interface CreateFinancialTypeInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateFinancialTypeInput {
  name?: string
  [k: string]: unknown
}
