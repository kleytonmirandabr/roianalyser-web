// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/companies.

export interface Company {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/companies no backend
  [k: string]: unknown
}
export interface CreateCompanyInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateCompanyInput {
  name?: string
  [k: string]: unknown
}
