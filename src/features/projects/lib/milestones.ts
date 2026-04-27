/**
 * Marcos do projeto (cronograma de delivery).
 *
 * A partir da Onda 3.B, milestones moram em tabela própria (`milestones`)
 * com schema rico: intervalo de datas (start + end), progresso 0-100%,
 * sub-tarefas (parentId), dependências (dependsOn[]), multi-responsável.
 *
 * O legado em `payload.milestones[]` continua sendo lido como FALLBACK
 * pra projetos que ainda não foram migrados (rolling deploy + backfill
 * idempotente). Quando a API responde 200, os dados vêm direto da tabela.
 *
 * Os helpers `readMilestones` e `serializeMilestones` continuam disponíveis
 * pra ler/escrever no formato legado quando necessário (compat).
 */

export type MilestoneStatus =
  | 'pending'
  | 'in-progress'
  | 'done'
  | 'late'
  | 'blocked'

export type Milestone = {
  id: string
  /** Projeto a que esse marco pertence. */
  contractId?: string
  /**
   * ID do milestone-pai (sub-tarefa). null = top-level.
   */
  parentId?: string | null
  title: string
  description?: string | null
  /**
   * Data prevista de início (YYYY-MM-DD). Quando ausente mas
   * `plannedEndDate` está presente, o sistema trata como milestone "ponto"
   * (compat com legado que tinha só uma data).
   */
  plannedStartDate?: string | null
  /** Data prevista de fim (YYYY-MM-DD). Sucessor do legado `plannedDate`. */
  plannedEndDate?: string | null
  /** Início real (YYYY-MM-DD). Opcional — quando o trabalho começou. */
  actualStartDate?: string | null
  /** Conclusão real (YYYY-MM-DD). Sucessor do legado `actualDate`. */
  actualEndDate?: string | null
  status: MilestoneStatus
  /** Progresso 0-100. Default 0. */
  progress?: number
  /**
   * IDs de outros milestones que precisam terminar antes deste começar.
   * Renderizado como linhas de dependência no Gantt.
   */
  dependsOn?: string[]
  /** Multi-responsável. Sucessor do legado `responsibleId` (string). */
  responsibleIds?: string[]
  /** Ordem manual (DnD pra reordenar). */
  order: number
  createdAt?: string
  updatedAt?: string
  /* ─── compat legado (opcional) ─── */
  /** @deprecated use plannedEndDate. */
  plannedDate?: string
  /** @deprecated use actualEndDate. */
  actualDate?: string | null
  /** @deprecated use responsibleIds. */
  responsibleId?: string | null
}

let __idCounter = 0
function nextId(): string {
  __idCounter += 1
  return `ms_${Date.now().toString(36)}_${__idCounter}`
}

export function makeMilestone(partial?: Partial<Milestone>): Milestone {
  // Compat: aceita plannedDate (legado) e converte pra plannedEndDate.
  const plannedEnd =
    partial?.plannedEndDate ?? partial?.plannedDate ?? null
  const actualEnd = partial?.actualEndDate ?? partial?.actualDate ?? null
  const responsibleIds =
    partial?.responsibleIds ??
    (partial?.responsibleId ? [partial.responsibleId] : [])

  return {
    id: partial?.id ?? nextId(),
    contractId: partial?.contractId,
    parentId: partial?.parentId ?? null,
    title: partial?.title ?? '',
    description: partial?.description ?? null,
    plannedStartDate: partial?.plannedStartDate ?? plannedEnd ?? null,
    plannedEndDate: plannedEnd,
    actualStartDate: partial?.actualStartDate ?? null,
    actualEndDate: actualEnd,
    status: partial?.status ?? 'pending',
    progress:
      typeof partial?.progress === 'number'
        ? Math.max(0, Math.min(100, Math.round(partial.progress)))
        : 0,
    dependsOn: Array.isArray(partial?.dependsOn) ? partial.dependsOn : [],
    responsibleIds,
    order:
      typeof partial?.order === 'number'
        ? partial.order
        : Number.MAX_SAFE_INTEGER,
    createdAt: partial?.createdAt,
    updatedAt: partial?.updatedAt,
    /* compat — manter dados legados pra serialização payload se precisar */
    plannedDate: partial?.plannedDate,
    actualDate: partial?.actualDate,
    responsibleId: partial?.responsibleId,
  }
}

/**
 * Lê milestones do payload do projeto (formato legado). Usado como
 * FALLBACK quando a API da tabela `milestones` ainda não retornou (404
 * ou loading inicial). Após backfill total, ainda é útil pra UI offline
 * ou pra ler dados antes da sessão ter token.
 */
export function readMilestones(
  payload: Record<string, unknown> | null | undefined,
): Milestone[] {
  if (!payload) return []
  const raw = payload.milestones
  if (!Array.isArray(raw)) return []
  return raw
    .map((m, idx) => {
      const obj = m as Partial<Milestone>
      return makeMilestone({
        id: typeof obj.id === 'string' ? obj.id : undefined,
        title: typeof obj.title === 'string' ? obj.title : '',
        description:
          typeof obj.description === 'string' ? obj.description : undefined,
        plannedDate:
          typeof obj.plannedDate === 'string' ? obj.plannedDate : undefined,
        plannedEndDate:
          typeof obj.plannedEndDate === 'string' ? obj.plannedEndDate : undefined,
        plannedStartDate:
          typeof obj.plannedStartDate === 'string' ? obj.plannedStartDate : undefined,
        actualDate:
          typeof obj.actualDate === 'string' ? obj.actualDate : null,
        actualEndDate:
          typeof obj.actualEndDate === 'string' ? obj.actualEndDate : null,
        status:
          obj.status === 'in-progress' ||
          obj.status === 'done' ||
          obj.status === 'late' ||
          obj.status === 'blocked'
            ? obj.status
            : 'pending',
        progress: typeof obj.progress === 'number' ? obj.progress : 0,
        dependsOn: Array.isArray(obj.dependsOn) ? obj.dependsOn : [],
        responsibleId:
          typeof obj.responsibleId === 'string' ? obj.responsibleId : null,
        responsibleIds: Array.isArray(obj.responsibleIds)
          ? obj.responsibleIds
          : undefined,
        parentId:
          typeof obj.parentId === 'string' ? obj.parentId : null,
        order: typeof obj.order === 'number' ? obj.order : idx,
        createdAt:
          typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
        updatedAt:
          typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
      })
    })
    .sort((a, b) => a.order - b.order)
}

export function serializeMilestones(milestones: Milestone[]) {
  return milestones.map((m, idx) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    parentId: m.parentId,
    plannedStartDate: m.plannedStartDate,
    plannedEndDate: m.plannedEndDate,
    actualStartDate: m.actualStartDate,
    actualEndDate: m.actualEndDate,
    status: m.status,
    progress: m.progress,
    dependsOn: m.dependsOn,
    responsibleIds: m.responsibleIds,
    /* compat */
    plannedDate: m.plannedEndDate ?? m.plannedDate,
    actualDate: m.actualEndDate ?? m.actualDate,
    responsibleId:
      (m.responsibleIds && m.responsibleIds[0]) ?? m.responsibleId ?? null,
    order: idx,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }))
}

/**
 * Computa status efetivo levando em conta data atual: se está pending mas
 * a data fim já passou, marca como late. Não muda status persistido.
 */
export function effectiveStatus(
  milestone: Milestone,
  now: Date = new Date(),
): MilestoneStatus {
  if (milestone.status === 'done' || milestone.status === 'blocked') {
    return milestone.status
  }
  const planned = milestone.plannedEndDate ?? milestone.plannedDate
  if (!planned) return milestone.status
  const plannedDate = new Date(planned + 'T23:59:59')
  if (Number.isNaN(plannedDate.getTime())) return milestone.status
  if (now.getTime() > plannedDate.getTime()) return 'late'
  return milestone.status
}
