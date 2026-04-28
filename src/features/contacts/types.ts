// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/contacts.

export interface Contact {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/contacts no backend
  [k: string]: unknown
}
export interface CreateContactInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateContactInput {
  name?: string
  [k: string]: unknown
}
