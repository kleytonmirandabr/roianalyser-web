/**
 * Histórico humano de eventos do projeto.
 *
 * Diferente do audit_log técnico (que é cross-tenant e captura toda
 * mudança via repository), o activityLog é um feed legível por pessoa
 * pra acompanhar a vida do projeto. Mantido em payload.activityLog.
 *
 * Exemplos:
 *   - "João moveu de Negociação para Ganho"
 *   - "Maria adicionou marco 'Kick-off'"
 *   - "Pedro completou marco 'Levantamento' (5 dias após o previsto)"
 *   - "Carla marcou Out/26 como Pago (R$ 35.000)"
 */

export type ActivityEventType =
  | 'status_change'
  | 'team_assigned'
  | 'team_removed'
  | 'milestone_added'
  | 'milestone_completed'
  | 'milestone_late'
  | 'attachment_added'
  | 'forecast_updated'
  | 'task_assigned'
  | 'comment_added'
  | 'comment_resolved'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'note'

export type ActivityEvent = {
  id: string
  type: ActivityEventType
  /** Texto pronto pra exibir (já formatado em PT). */
  message: string
  /** Timestamp ISO. */
  at: string
  /** Quem fez. */
  actorId?: string
  actorName?: string
  /** Metadados pra renderização rica (opcional). */
  meta?: Record<string, unknown>
}

let __idCounter = 0
function nextId(): string {
  __idCounter += 1
  return `evt_${Date.now().toString(36)}_${__idCounter}`
}

export function makeEvent(input: Omit<ActivityEvent, 'id' | 'at'> & { at?: string }): ActivityEvent {
  return {
    id: nextId(),
    at: input.at ?? new Date().toISOString(),
    ...input,
  }
}

export function readActivityLog(
  payload: Record<string, unknown> | null | undefined,
): ActivityEvent[] {
  if (!payload) return []
  const raw = payload.activityLog
  if (!Array.isArray(raw)) return []
  return raw
    .map((e) => {
      const obj = e as Partial<ActivityEvent>
      return {
        id: typeof obj.id === 'string' ? obj.id : nextId(),
        type: (obj.type as ActivityEventType) ?? 'note',
        message: typeof obj.message === 'string' ? obj.message : '',
        at: typeof obj.at === 'string' ? obj.at : new Date().toISOString(),
        actorId: typeof obj.actorId === 'string' ? obj.actorId : undefined,
        actorName: typeof obj.actorName === 'string' ? obj.actorName : undefined,
        meta: obj.meta && typeof obj.meta === 'object' ? obj.meta : undefined,
      } as ActivityEvent
    })
    .sort((a, b) => b.at.localeCompare(a.at)) // mais recente primeiro
}

/** Aplica um novo evento ao log e devolve novo array. */
export function appendEvent(
  log: ActivityEvent[],
  event: ActivityEvent,
  /** Quantos eventos máximo manter. Default 200. */
  maxLength = 200,
): ActivityEvent[] {
  const next = [event, ...log]
  if (next.length > maxLength) next.length = maxLength
  return next
}

/**
 * Helper conveniente: lê o log do payload, anexa um novo evento, e
 * retorna o array pronto pra mesclar de volta no payload.
 */
export function logEvent(
  payload: Record<string, unknown> | null | undefined,
  event: Omit<ActivityEvent, 'id' | 'at'> & { at?: string },
): ActivityEvent[] {
  const current = readActivityLog(payload)
  return appendEvent(current, makeEvent(event))
}
