// Auto-gerado pelo template do #177.
// Campos da entidade espelham o backend; vide /admin/user-groups.

export interface UserGroup {
  id: string
  tenantId: string
  key: string
  name: string
  // demais campos: ver /api/user-groups no backend
  [k: string]: unknown
}
export interface CreateUserGroupInput {
  key: string
  name: string
  [k: string]: unknown
}
export interface UpdateUserGroupInput {
  name?: string
  [k: string]: unknown
}
