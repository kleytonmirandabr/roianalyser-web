// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/sales-goals.

export interface SalesGoal {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/sales-goals no backend
  [k: string]: unknown
}
export interface CreateSalesGoalInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateSalesGoalInput {
  name?: string
  [k: string]: unknown
}
