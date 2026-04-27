/**
 * Categorias canônicas dos status de projeto.
 *
 * O cliente pode dar o nome que quiser pra cada status (Closed Won,
 * Em Negociação, Cancelado pelo cliente…). Mas o sistema precisa saber
 * o que cada status SIGNIFICA pra disparar automações:
 *   - won: cria forecast/cronograma vazios; libera execução
 *   - lost: bloqueia projeto no rolling forecast; pede motivo
 *   - execution: aciona time de delivery
 *   - invoicing: libera campos de faturamento
 *   - done: encerra projeto
 *   - warranty: pós-conclusão (suporte/garantia)
 *   - cancelled: descontinuado, mantém pra auditoria
 *   - negotiation: status genéricos do funil de vendas
 *
 * REGRA: só pode existir UM status por categoria (exceto negotiation,
 * que aceita múltiplos status do funil — "Lead", "Proposta", etc).
 */

export type StatusCategory =
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'execution'
  | 'invoicing'
  | 'done'
  | 'warranty'
  | 'cancelled'

export const STATUS_CATEGORIES: StatusCategory[] = [
  'negotiation',
  'won',
  'lost',
  'execution',
  'invoicing',
  'done',
  'warranty',
  'cancelled',
]

/**
 * Categorias que aceitam VÁRIOS status (funil de vendas).
 * As outras só aceitam 1 status do tenant cada.
 */
const MULTI_STATUS_CATEGORIES = new Set<StatusCategory>(['negotiation'])

export function categoryAcceptsMultiple(category: StatusCategory): boolean {
  return MULTI_STATUS_CATEGORIES.has(category)
}

export type ProjectStatus = {
  id: string
  name: string
  color?: string
  order?: number
  active?: boolean
  category?: StatusCategory | null
}

/**
 * Validação ao salvar/editar status. Retorna o id do status conflitante,
 * ou null se OK.
 */
export function findCategoryConflict(
  statuses: ProjectStatus[],
  newOrEditedStatus: ProjectStatus,
): { conflictingStatus: ProjectStatus } | null {
  const cat = newOrEditedStatus.category
  if (!cat) return null
  if (categoryAcceptsMultiple(cat)) return null
  const others = statuses.filter(
    (s) => s.id !== newOrEditedStatus.id && s.category === cat && s.active !== false,
  )
  if (others.length === 0) return null
  return { conflictingStatus: others[0] }
}

/**
 * Encontra status do tenant que tem certa categoria.
 * Retorna undefined se não houver, ou o primeiro encontrado.
 */
export function findStatusByCategory(
  statuses: ProjectStatus[],
  category: StatusCategory,
): ProjectStatus | undefined {
  return statuses.find((s) => s.category === category && s.active !== false)
}

/**
 * Verifica se um nome de status corresponde a determinada categoria,
 * usando primeiro o campo `category` se setado, e caindo para keyword
 * matching legado (compatibilidade com tenants antigos que ainda não
 * categorizaram seus status).
 */
const LEGACY_KEYWORDS: Record<StatusCategory, string[]> = {
  won: ['ganho', 'won', 'fechado', 'closed won'],
  lost: ['perda', 'perdida', 'lost', 'cancelad'],
  execution: ['execu', 'implementa', 'andamento', 'in progress'],
  invoicing: ['fatur', 'invoic', 'cobran'],
  done: ['conclu', 'done', 'finaliz', 'encerr'],
  warranty: ['garant', 'warranty'],
  cancelled: ['cancelad', 'abort'],
  negotiation: ['negoc', 'lead', 'proposta', 'qualif'],
}

export function statusInCategory(
  status: ProjectStatus,
  category: StatusCategory,
): boolean {
  if (status.category) return status.category === category
  // Fallback: tenant ainda não categorizou os status — usa keyword.
  const name = status.name?.toLowerCase() ?? ''
  return LEGACY_KEYWORDS[category].some((kw) => name.includes(kw))
}
