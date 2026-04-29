/**
 * Categorias canônicas dos status do funil (Oportunidade → Projeto).
 *
 * O cliente pode dar o nome que quiser pra cada status (Closed Won,
 * Em Negociação, Cancelado pelo cliente…). Mas o sistema precisa saber
 * o que cada status SIGNIFICA pra disparar automações:
 *   - negotiation: prospecção/qualificação inicial — só dados básicos
 *   - evaluation: faz ROI (Entradas, Financeiro, Resumo & Gráfico). Precisa aprovação
 *   - contract: contrato anexado e parametrizado. ROI fica em soft-block (alteração reabre aprovação)
 *   - won: vira Projeto: abre Cronograma + Forecast + atribuição de time
 *   - lost: bloqueia no rolling forecast; pede motivo de perda
 *   - execution: time de delivery em ação
 *   - invoicing: libera campos de faturamento
 *   - done: projeto encerrado
 *   - warranty: pós-conclusão (suporte/garantia)
 *   - cancelled: descontinuado, mantém pra auditoria
 *
 * REGRA: status SINGLE-instance por tenant (won, lost, invoicing, done,
 * warranty, cancelled). Status MULTI-instance (negotiation, evaluation,
 * contract, execution) aceitam vários (ex: "Aval. Técnica" + "Aval. Comercial").
 */

export type StatusCategory =
  | 'negotiation'
  | 'evaluation'
  | 'contract'
  | 'won'
  | 'lost'
  | 'execution'
  | 'invoicing'
  | 'done'
  | 'warranty'
  | 'cancelled'
  // Simplified taxonomy — DB-canonical buckets used em prod
  | 'in_progress'
  | 'gain'
  | 'loss'
  | 'qualified'

export const STATUS_CATEGORIES: StatusCategory[] = [
  'negotiation',
  'evaluation',
  'contract',
  'won',
  'lost',
  'execution',
  'invoicing',
  'done',
  'warranty',
  'cancelled',
  'in_progress',
  'gain',
  'loss',
  'qualified',
]

/** Rótulo PT-BR pra exibir no Combobox do admin de status. */
export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  negotiation: 'Negociação',
  evaluation: 'Avaliação (ROI)',
  contract: 'Contrato',
  won: 'Ganho (Win)',
  lost: 'Perda (Loss)',
  execution: 'Execução',
  invoicing: 'Faturamento',
  done: 'Concluído',
  warranty: 'Garantia',
  cancelled: 'Cancelado',
  in_progress: 'Em andamento',
  gain: 'Ganho',
  loss: 'Perda',
  qualified: 'Qualificada',
}

/**
 * Cor padrão sugerida quando o admin escolhe a categoria. Pré-preenche
 * o campo `color` do status — admin pode customizar livremente.
 */
export const STATUS_CATEGORY_DEFAULT_COLORS: Record<StatusCategory, string> = {
  negotiation: '#6b7280', // cinza
  evaluation: '#f59e0b', // amarelo/laranja
  contract: '#8b5cf6', // roxo
  won: '#10b981', // verde
  lost: '#ef4444', // vermelho
  execution: '#3b82f6', // azul
  invoicing: '#0ea5e9', // azul claro
  done: '#22c55e', // verde claro
  warranty: '#84cc16', // verde lima
  cancelled: '#9ca3af', // cinza médio
  in_progress: '#6366f1', // indigo
  gain: '#10b981', // verde
  loss: '#ef4444', // vermelho
  qualified: '#06b6d4', // ciano
}

/**
 * Categorias que aceitam VÁRIOS status (etapas múltiplas dentro da
 * categoria). As outras só aceitam 1 status do tenant cada.
 */
const MULTI_STATUS_CATEGORIES = new Set<StatusCategory>([
  'negotiation',
  'evaluation',
  'contract',
  'execution',
])

/**
 * Escopo do funil — usado pra dividir a navegação em "Oportunidades"
 * (pré-Win) e "Projetos" (pós-Win).
 *
 * - Oportunidades: leads em movimento + perdidos/cancelados (encerrados sem virar projeto)
 * - Projetos: pós-ganho (Win) — execução, faturamento, garantia, conclusão
 *
 * Status SEM categoria definida (legacy ou tenant ainda não migrado)
 * caem em **Oportunidades** por default — são leads pré-Win até alguém
 * categorizar.
 */
export const OPPORTUNITY_CATEGORIES: StatusCategory[] = [
  'negotiation',
  'evaluation',
  'contract',
  'lost',
  'cancelled',
  'in_progress',
  'qualified',
  'loss',
]

export const PROJECT_CATEGORIES: StatusCategory[] = [
  'won',
  'execution',
  'invoicing',
  'done',
  'warranty',
  'gain',
]

export type FunnelScope = 'opportunities' | 'projects'

/**
 * Checa se um projeto pertence ao escopo dado, dado o catálogo de status.
 * Considera também a keyword legacy quando o status não tem categoria.
 *
 * @param projectStatus nome do status no projeto (string livre, vindo do payload)
 * @param scope qual escopo: 'opportunities' ou 'projects'
 * @param allStatuses lista do catálogo /catalogs/project-statuses
 */
export function isInScope(
  projectStatus: string | null | undefined,
  scope: FunnelScope,
  allStatuses: ProjectStatus[],
): boolean {
  // Status vazio = sem definir = oportunidade (ainda em movimento).
  if (!projectStatus) return scope === 'opportunities'

  // Resolve categoria via catálogo, fallback pra keyword.
  const cataloged = allStatuses.find(
    (s) => s.name?.toLowerCase() === projectStatus.toLowerCase(),
  )
  let category: StatusCategory | null = cataloged?.category ?? null

  if (!category) {
    // Tenta inferir via keyword.
    for (const cat of STATUS_CATEGORIES) {
      if (statusInCategory({ id: '', name: projectStatus }, cat)) {
        category = cat
        break
      }
    }
  }

  // Sem categoria detectada → cai em Oportunidades (leads em qualificação).
  if (!category) return scope === 'opportunities'

  return scope === 'opportunities'
    ? OPPORTUNITY_CATEGORIES.includes(category)
    : PROJECT_CATEGORIES.includes(category)
}

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
  // 'gain' coberto pra tenants que usam status "GAIN" (ex: SODEP).
  won: ['ganho', 'gain', 'won', 'win', 'fechado', 'closed won'],
  // 'loss' (singular/plural) e 'lose' cobrem "LOSS"/"LOST" — keyword 'lost'
  // sozinha NÃO bate com "LOSS" porque includes('lost') falha em "loss".
  lost: ['perda', 'perdida', 'loss', 'lost', 'lose', 'cancelad'],
  execution: ['execu', 'implementa', 'andamento', 'in progress'],
  invoicing: ['fatur', 'invoic', 'cobran'],
  done: ['conclu', 'done', 'finaliz', 'encerr'],
  warranty: ['garant', 'warranty'],
  cancelled: ['cancelad', 'abort'],
  negotiation: ['negoc', 'lead', 'prospec', 'qualif', 'discover', 'definition'],
  // Avaliação cobre statuses tipo "EVALUATING", "Aval. Técnica", "Análise"
  evaluation: ['aval', 'evaluat', 'evaluation', 'analise', 'análise', 'roi review'],
  // Contrato cobre "Em elaboração", "Aguardando assinatura", "Proposta"
  contract: ['contrato', 'contract', 'proposta', 'proposal', 'assinatur', 'signing', 'sign'],
  // Simplified taxonomy — DB-canonical buckets
  in_progress: ['em andamento', 'in progress', 'oportunidade', 'avaliac', 'avaliaç', 'proposta'],
  gain: ['ganho', 'gain', 'won'],
  loss: ['perda', 'loss', 'lost'],
  qualified: ['qualif', 'qualified'],
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
