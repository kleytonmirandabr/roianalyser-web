/**
 * Report — espelha as rotas `/api/reports` do backend. O shape é flexível
 * porque o backend usa filtros customizados por relatório.
 */
export type Report = {
  id: string
  name: string
  description?: string
  ownerId?: string
  ownerName?: string
  /** Filtros e configurações do relatório (estrutura específica por tipo). */
  filters?: Record<string, unknown>
  /** Lista de userIds com quem o relatório está compartilhado. */
  sharedWith?: string[]
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

/** Resposta de POST /api/reports/:id/run — payload com o resultado calculado. */
export type ReportRunResult = {
  reportId?: string
  generatedAt?: string
  /** Resultado pode ser linhas tabulares, agregações, etc. */
  rows?: Array<Record<string, unknown>>
  summary?: Record<string, unknown>
  [key: string]: unknown
}
