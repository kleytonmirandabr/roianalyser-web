// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/catalog-items.

export interface CatalogItem {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/catalog-items no backend
  [k: string]: unknown
}
export interface CreateCatalogItemInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateCatalogItemInput {
  name?: string
  [k: string]: unknown
}
