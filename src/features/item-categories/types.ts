// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/item-categories.

export interface ItemCategory {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/item-categories no backend
  [k: string]: unknown
}
export interface CreateItemCategoryInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateItemCategoryInput {
  name?: string
  [k: string]: unknown
}
