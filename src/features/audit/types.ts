/** Evento de auditoria conforme retornado por GET /api/audit-log */
export type AuditEvent = {
  id: string
  ts: string | null
  type: string
  message: string
  entityId: string
  entityName: string
  entityType: string | null
  clientId: string
  clientName: string
  user: string
  userId: string
}
