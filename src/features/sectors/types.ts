// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/sectors.

export interface Sector {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/sectors no backend
  [k: string]: unknown
}
export interface CreateSectorInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateSectorInput {
  name?: string
  [k: string]: unknown
}
