/**
 * Workflow rules / transition gates.
 *
 * Regras configuradas pelo Master que validam transição de status num
 * projeto. Cada regra dispara quando o projeto entra numa categoria
 * (ex: 'won', 'execution') e exige condições antes de permitir.
 *
 * Tipos de exigência suportados:
 *   - requiresFields[]:  campos do projeto que precisam estar preenchidos
 *                        (ex: 'totalRevenue', 'startDate', 'clientName')
 *   - requiresChecklist[]:  itens textuais que precisam ser confirmados
 *                           (ex: "Contrato assinado", "PO recebido")
 *   - requiresApproverIds[]:  IDs de usuários que precisam aprovar antes.
 *                             Vira PendingApproval no projeto.
 *   - thresholdValue: opcional, valor mínimo de receita pra disparar
 *                     a exigência de aprovação. Se omitido, sempre exige.
 *
 * Decisão de design: regras moram no app-state (systemRules.workflowRules)
 * em vez de tabela própria. Reaproveita a infra de patch/load do appState
 * e fica trivial de versionar/exportar. Migração pra tabela própria fica
 * pra depois — só implica mudar 2 hooks, sem tocar a UI.
 *
 * Uso típico:
 *   const result = canTransitionTo(project, targetCategory, rules, statuses)
 *   if (!result.ok) showBlockedDialog(result.reasons)
 *   else proceedTransition()
 */

import type { Project } from '@/features/projects/types'
import type { StatusCategory, ProjectStatus } from './status-categories'
import { statusInCategory } from './status-categories'

export type WorkflowRule = {
  id: string
  /**
   * Categoria de destino que dispara a regra. Ex: 'won' = a regra ativa
   * quando o projeto vai pra status de categoria "won".
   */
  toCategory: StatusCategory
  /**
   * Categoria de origem (opcional). Se omitido, regra ativa em qualquer
   * transição PARA toCategory. Útil pra regras "ganho só vem de negociação".
   */
  fromCategory?: StatusCategory
  /** Nome humano da regra (apenas pra UI). */
  name: string
  /** Descrição do porquê dessa regra (pra ajudar o usuário entender). */
  description?: string
  /** Campos do payload OU do project que precisam estar preenchidos. */
  requiresFields?: string[]
  /** Itens de checklist que o usuário precisa confirmar. */
  requiresChecklist?: string[]
  /** IDs de aprovadores. Se thresholdValue setado, só exige acima do valor. */
  requiresApproverIds?: string[]
  /** Valor mínimo de receita pra exigir aprovação. */
  thresholdValue?: number
  /** Ativa/desativa a regra sem deletar. Default true. */
  enabled?: boolean
}

export type PendingApproval = {
  id: string
  ruleId: string
  /** Categoria de destino que disparou. */
  toCategory: StatusCategory
  /** Quem precisa aprovar (snapshot da regra no momento). */
  approverIds: string[]
  /** Quem solicitou (geralmente quem tentou transição). */
  requestedBy?: string
  requestedByName?: string
  requestedAt: string
  /** Aprovações concedidas: { userId: { at, name? } } */
  grants?: Record<string, { at: string; name?: string }>
  /** Negação (qualquer aprovador pode negar e isso bloqueia). */
  deniedBy?: string
  deniedByName?: string
  deniedAt?: string
  deniedReason?: string
  /** Resolvido (concedido completo). */
  resolvedAt?: string
}

export type TransitionCheck = {
  ok: boolean
  /** Lista de razões/exigências não cumpridas. Vazia se ok. */
  reasons: TransitionReason[]
  /** Regras aplicáveis (pra mostrar checklist quando houver). */
  applicableRules: WorkflowRule[]
}

export type TransitionReason =
  | { kind: 'missing_field'; field: string; ruleName: string }
  | { kind: 'pending_checklist'; item: string; ruleName: string }
  | { kind: 'requires_approval'; rule: WorkflowRule; thresholdMet: boolean }

/**
 * Lê a lista de regras configurada no appState (systemRules.workflowRules).
 * Retorna sempre array — vazio se ainda não configurou.
 */
export function readWorkflowRules(
  systemRules: Record<string, unknown> | null | undefined,
): WorkflowRule[] {
  if (!systemRules) return []
  const raw = systemRules.workflowRules
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      const o = r as Partial<WorkflowRule>
      if (!o.id || !o.toCategory) return null
      return {
        id: String(o.id),
        toCategory: o.toCategory as StatusCategory,
        fromCategory: o.fromCategory as StatusCategory | undefined,
        name: String(o.name ?? o.id),
        description: typeof o.description === 'string' ? o.description : undefined,
        requiresFields: Array.isArray(o.requiresFields)
          ? o.requiresFields.filter((f): f is string => typeof f === 'string')
          : undefined,
        requiresChecklist: Array.isArray(o.requiresChecklist)
          ? o.requiresChecklist.filter((f): f is string => typeof f === 'string')
          : undefined,
        requiresApproverIds: Array.isArray(o.requiresApproverIds)
          ? o.requiresApproverIds.filter((f): f is string => typeof f === 'string')
          : undefined,
        thresholdValue:
          typeof o.thresholdValue === 'number' ? o.thresholdValue : undefined,
        enabled: o.enabled !== false,
      } as WorkflowRule
    })
    .filter((r): r is WorkflowRule => !!r && r.enabled !== false)
}

/**
 * Calcula receita total estimada do projeto pra avaliar threshold.
 * Lê de payload.totalRevenue se setado, senão soma cashFlow se disponível.
 */
function projectRevenue(project: Project): number {
  const payload = (project.payload ?? {}) as Record<string, unknown>
  if (typeof payload.totalRevenue === 'number') return payload.totalRevenue
  // Fallback: alguns projetos legados têm o valor solto no top-level.
  const top = project as unknown as Record<string, unknown>
  if (typeof top.totalRevenue === 'number') return top.totalRevenue
  return 0
}

/**
 * Verifica se um campo do projeto está preenchido. Suporta tanto top-level
 * (project.name, project.clientName) quanto payload.x.
 */
function hasField(project: Project, field: string): boolean {
  // tenta top-level primeiro
  const topVal = (project as unknown as Record<string, unknown>)[field]
  if (topVal != null && topVal !== '') return true
  const payload = (project.payload ?? {}) as Record<string, unknown>
  const payloadVal = payload[field]
  return payloadVal != null && payloadVal !== ''
}

/**
 * Lê o estado atual de aprovações pendentes do projeto.
 */
export function readPendingApprovals(
  payload: Record<string, unknown> | null | undefined,
): PendingApproval[] {
  if (!payload) return []
  const raw = payload.pendingApprovals
  if (!Array.isArray(raw)) return []
  return raw as PendingApproval[]
}

/**
 * Avalia se uma transição pode acontecer.
 *
 * Retorna { ok, reasons, applicableRules }. Quando !ok, a UI mostra
 * cada `reason` no modal de bloqueio com a ação apropriada (preencher
 * campo, confirmar item, solicitar aprovação).
 *
 * `confirmedChecklist` é o conjunto de itens que o usuário JÁ marcou
 * no modal — eles são considerados cumpridos. Permite o fluxo "abro o
 * modal, marco os checks, clico Confirmar".
 *
 * `existingApprovals` é a lista atual de pendingApprovals do projeto —
 * se já existe aprovação concedida pra regra, conta como cumprida.
 */
export function canTransitionTo(input: {
  project: Project
  fromCategory: StatusCategory | null
  toCategory: StatusCategory
  rules: WorkflowRule[]
  /** Itens de checklist confirmados na sessão atual. */
  confirmedChecklist?: Set<string>
  /** Approvals já concedidas pra esse projeto. */
  existingApprovals?: PendingApproval[]
}): TransitionCheck {
  const {
    project,
    fromCategory,
    toCategory,
    rules,
    confirmedChecklist = new Set(),
    existingApprovals = [],
  } = input

  const applicable = rules.filter((r) => {
    if (r.toCategory !== toCategory) return false
    if (r.fromCategory && fromCategory !== r.fromCategory) return false
    return r.enabled !== false
  })

  const reasons: TransitionReason[] = []

  for (const rule of applicable) {
    // 1. Campos obrigatórios
    for (const field of rule.requiresFields ?? []) {
      if (!hasField(project, field)) {
        reasons.push({ kind: 'missing_field', field, ruleName: rule.name })
      }
    }

    // 2. Checklist
    for (const item of rule.requiresChecklist ?? []) {
      if (!confirmedChecklist.has(`${rule.id}::${item}`)) {
        reasons.push({ kind: 'pending_checklist', item, ruleName: rule.name })
      }
    }

    // 3. Aprovações
    if (rule.requiresApproverIds && rule.requiresApproverIds.length > 0) {
      const thresholdMet =
        rule.thresholdValue == null ||
        projectRevenue(project) >= rule.thresholdValue
      if (thresholdMet) {
        // Procura aprovação concedida pra essa regra
        const approval = existingApprovals.find(
          (a) =>
            a.ruleId === rule.id &&
            a.toCategory === toCategory &&
            !!a.resolvedAt &&
            !a.deniedAt,
        )
        if (!approval) {
          reasons.push({
            kind: 'requires_approval',
            rule,
            thresholdMet: true,
          })
        }
      }
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    applicableRules: applicable,
  }
}

/**
 * Determina a categoria de um status (id ou name) pra alimentar o fluxo
 * de transição. Faz fallback de keyword se a categoria não estiver setada.
 */
export function categoryFor(
  statusName: string | null | undefined,
  statuses: ProjectStatus[],
): StatusCategory | null {
  if (!statusName) return null
  const found = statuses.find((s) => s.name === statusName)
  if (found?.category) return found.category
  // Fallback keyword
  const fakeStatus: ProjectStatus = found ?? { id: '', name: statusName }
  for (const cat of [
    'won',
    'lost',
    'execution',
    'invoicing',
    'done',
    'warranty',
    'cancelled',
    'negotiation',
  ] as StatusCategory[]) {
    if (statusInCategory(fakeStatus, cat)) return cat
  }
  return null
}

let __idCounter = 0
function nextApprovalId(): string {
  __idCounter += 1
  return `apr_${Date.now().toString(36)}_${__idCounter}`
}

export function makePendingApproval(input: {
  rule: WorkflowRule
  requestedBy?: string
  requestedByName?: string
}): PendingApproval {
  return {
    id: nextApprovalId(),
    ruleId: input.rule.id,
    toCategory: input.rule.toCategory,
    approverIds: input.rule.requiresApproverIds ?? [],
    requestedBy: input.requestedBy,
    requestedByName: input.requestedByName,
    requestedAt: new Date().toISOString(),
    grants: {},
  }
}

/**
 * Aplica grant de aprovação. Se todos os approvers aprovaram, marca
 * resolvedAt — a transição que estava esperando é liberada.
 */
export function grantApproval(
  approval: PendingApproval,
  user: { id: string; name?: string },
): PendingApproval {
  const grants = { ...(approval.grants ?? {}) }
  grants[user.id] = {
    at: new Date().toISOString(),
    name: user.name,
  }
  const allGranted = approval.approverIds.every((id) => !!grants[id])
  return {
    ...approval,
    grants,
    resolvedAt: allGranted ? new Date().toISOString() : approval.resolvedAt,
  }
}

export function denyApproval(
  approval: PendingApproval,
  user: { id: string; name?: string },
  reason?: string,
): PendingApproval {
  return {
    ...approval,
    deniedBy: user.id,
    deniedByName: user.name,
    deniedAt: new Date().toISOString(),
    deniedReason: reason,
  }
}

/**
 * Devolve as approvals em que o user é approver e ainda não respondeu.
 * Usado no /me pra mostrar "Aprovações pendentes".
 */
export function approvalsForUser(
  approvals: PendingApproval[],
  userId: string,
): PendingApproval[] {
  return approvals.filter(
    (a) =>
      !a.resolvedAt &&
      !a.deniedAt &&
      a.approverIds.includes(userId) &&
      !(a.grants?.[userId]),
  )
}
