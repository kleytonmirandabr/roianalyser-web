// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/lead-sources.

export interface LeadSource {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/lead-sources no backend
  [k: string]: unknown
}
export interface CreateLeadSourceInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateLeadSourceInput {
  name?: string
  [k: string]: unknown
}
