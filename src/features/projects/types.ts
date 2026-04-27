/**
 * Modelo do "Projeto" (chamado de Contract no backend).
 * Espelha `backend/src/infrastructure/persistence/typeorm/entities/contract.entity.js`
 * + o `payload` JSON livre que carrega os campos dinâmicos do projeto:
 * `entryGroups` (Entradas Dinâmicas), inputs financeiros (prazo, comissão,
 * impostos, meta de margem) e campos legados de payloads antigos do
 * vanilla. Tipagem permissiva via `Record<string, unknown>` para tolerar
 * variações entre projetos.
 */

export type ContractStatus = string // ex: 'draft', 'active', 'won', etc — vem do catálogo de status

export type Project = {
  id: string
  name: string
  tenantId: string
  status: ContractStatus
  currency: string
  active: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  deletedBy?: string | null

  /**
   * Campos dinâmicos do projeto: cliente, datas, responsável, descrição,
   * `entryGroups` (Entradas Dinâmicas), inputs financeiros e dados legados
   * de payloads antigos do vanilla.
   */
  payload?: ProjectPayload | null

  // Campos adicionais que podem vir no shape do GET (clientName, etc.)
  [key: string]: unknown
}

export type ProjectPayload = {
  name?: string
  description?: string
  status?: string
  responsible?: string
  clientId?: string
  clientName?: string
  startDate?: string
  endDate?: string
  contractType?: string
  /** Campos adicionais (entryGroups, prazo/comissão/impostos, legados, …) */
  [key: string]: unknown
}

export type ProjectSummary = Pick<
  Project,
  'id' | 'name' | 'tenantId' | 'status' | 'currency' | 'active' | 'updatedAt'
> & {
  payload?: ProjectPayload | null
}

export type CreateProjectInput = {
  name: string
  status?: string
  currency?: string
  payload?: ProjectPayload
}

export type UpdateProjectInput = Partial<
  Pick<Project, 'name' | 'status' | 'currency' | 'active'>
> & {
  payload?: ProjectPayload
}
