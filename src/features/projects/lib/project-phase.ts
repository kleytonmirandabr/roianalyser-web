/**
 * Resolve em que FASE do funil um projeto está, dada a string de status
 * e o catálogo de status (com categorias). Determina visibilidade de abas
 * no detalhe e comportamentos do tipo "soft-block do ROI em Contrato".
 *
 * Filosofia "compat-friendly": se o status do projeto não tem categoria
 * definível (catálogo + keyword fallback), retorna `null` — o consumidor
 * decide se quer mostrar tudo (default) ou esconder.
 */

import {
  STATUS_CATEGORIES,
  statusInCategory,
  type ProjectStatus,
  type StatusCategory,
} from './status-categories'

/**
 * Resolve a categoria de um projeto a partir do nome do status. Tenta
 * match exato no catálogo, depois keyword fallback. Retorna `null` se
 * nada bater (sem categoria, ou tenant ainda não migrou).
 */
export function getProjectCategory(
  projectStatus: string | null | undefined,
  allStatuses: ProjectStatus[],
): StatusCategory | null {
  if (!projectStatus) return null
  const cataloged = allStatuses.find(
    (s) => s.name?.toLowerCase() === projectStatus.toLowerCase(),
  )
  if (cataloged?.category) return cataloged.category
  for (const cat of STATUS_CATEGORIES) {
    if (statusInCategory({ id: '', name: projectStatus }, cat)) return cat
  }
  return null
}

/**
 * Mapa de visibilidade de abas por categoria. `null` = sempre visível
 * (não filtrado por fase).
 *
 * - **info / tasks / comments / attachments / history**: sempre visíveis.
 * - **resumo / entradas / financeiro (ROI)**: pré-Win — negotiation,
 *   evaluation, contract. Em `contract`, soft-block (banner amarelo).
 * - **schedule (Cronograma) / forecast**: pós-Win — won, execution,
 *   invoicing, done, warranty.
 * - **contract**: contract+, ou seja contract, won, execution, invoicing,
 *   done, warranty.
 *
 * Status SEM categoria (`null`) → mostra TUDO. Compat com tenants ainda
 * não migrados — só vai filtrar quando admin categorizar.
 */
export const TAB_VISIBILITY: Record<string, StatusCategory[] | null> = {
  info: null,
  resumo: ['negotiation', 'evaluation', 'contract'],
  entradas: ['negotiation', 'evaluation', 'contract'],
  financeiro: ['negotiation', 'evaluation', 'contract'],
  forecast: ['won', 'execution', 'invoicing', 'done', 'warranty'],
  schedule: ['won', 'execution', 'invoicing', 'done', 'warranty'],
  contract: [
    'contract',
    'won',
    'execution',
    'invoicing',
    'done',
    'warranty',
  ],
  attachments: null,
  tasks: null,
  comments: null,
  history: null,
}

export function isTabVisible(
  tabKey: string,
  category: StatusCategory | null,
): boolean {
  const allowed = TAB_VISIBILITY[tabKey]
  if (!allowed) return true // sempre visível
  if (!category) return true // sem categoria → permissivo (compat)
  return allowed.includes(category)
}

/**
 * O ROI fica em soft-block quando a oportunidade entrou na fase de
 * contrato — alterações ainda permitidas, mas reabrem a aprovação.
 * Banner amarelo mostrado nas abas Resumo/Entradas/Financeiro.
 */
export function isRoiSoftBlocked(category: StatusCategory | null): boolean {
  return category === 'contract'
}
