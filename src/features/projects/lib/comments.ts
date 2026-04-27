/**
 * Comentários de um projeto. Persistidos em payload.comments[]. É um feed
 * cronológico legível por humanos — diferente do activityLog (eventos
 * automáticos) e diferente do audit_log técnico.
 *
 * Caso de uso típico:
 *   - João escreve "Cliente pediu prazo de pagamento de 90 dias, podemos?"
 *   - Maria responde marcando como resolvido após combinarem o ajuste
 *   - O comentário fica preservado pra auditoria histórica
 *
 * Quando virar tabela própria (Sprint pós-deploy), a forma de leitura/escrita
 * muda só na hook `useProjectComments` — o resto do código continua igual.
 */

export type ProjectComment = {
  id: string
  /** Texto do comentário. Markdown leve permitido (parágrafos, links). */
  body: string
  /** Quem escreveu (id + nome cacheado pra exibição offline). */
  authorId?: string
  authorName?: string
  /** ISO timestamp da criação. */
  createdAt: string
  /** Última edição, se houve. */
  updatedAt?: string
  /** Marcado como resolvido — não some, mas vira "fechado". */
  resolvedAt?: string
  resolvedBy?: string
  /**
   * IDs de usuários mencionados (@nome). Vazio se nenhum.
   * Usado pra notificar/destacar — pode ficar pra v2.
   */
  mentions?: string[]
}

let __idCounter = 0
function nextId(): string {
  __idCounter += 1
  return `cmt_${Date.now().toString(36)}_${__idCounter}`
}

export function makeComment(
  input: Omit<ProjectComment, 'id' | 'createdAt'> & { createdAt?: string },
): ProjectComment {
  return {
    id: nextId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...input,
  }
}

export function readComments(
  payload: Record<string, unknown> | null | undefined,
): ProjectComment[] {
  if (!payload) return []
  const raw = payload.comments
  if (!Array.isArray(raw)) return []
  return raw
    .map((c) => {
      const obj = c as Partial<ProjectComment>
      return {
        id: typeof obj.id === 'string' ? obj.id : nextId(),
        body: typeof obj.body === 'string' ? obj.body : '',
        authorId: typeof obj.authorId === 'string' ? obj.authorId : undefined,
        authorName:
          typeof obj.authorName === 'string' ? obj.authorName : undefined,
        createdAt:
          typeof obj.createdAt === 'string'
            ? obj.createdAt
            : new Date().toISOString(),
        updatedAt:
          typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
        resolvedAt:
          typeof obj.resolvedAt === 'string' ? obj.resolvedAt : undefined,
        resolvedBy:
          typeof obj.resolvedBy === 'string' ? obj.resolvedBy : undefined,
        mentions: Array.isArray(obj.mentions)
          ? obj.mentions.filter((m): m is string => typeof m === 'string')
          : undefined,
      } as ProjectComment
    })
    .filter((c) => c.body) // descarta vazios
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // mais recente primeiro
}

export function addComment(
  list: ProjectComment[],
  comment: ProjectComment,
): ProjectComment[] {
  return [comment, ...list]
}

export function updateComment(
  list: ProjectComment[],
  id: string,
  patch: Partial<ProjectComment>,
): ProjectComment[] {
  const now = new Date().toISOString()
  return list.map((c) =>
    c.id === id ? { ...c, ...patch, updatedAt: now } : c,
  )
}

export function removeComment(
  list: ProjectComment[],
  id: string,
): ProjectComment[] {
  return list.filter((c) => c.id !== id)
}

export function resolveComment(
  list: ProjectComment[],
  id: string,
  user: { id?: string; name?: string },
): ProjectComment[] {
  return list.map((c) =>
    c.id === id
      ? {
          ...c,
          resolvedAt: new Date().toISOString(),
          resolvedBy: user.id || user.name || 'unknown',
        }
      : c,
  )
}

export function unresolveComment(
  list: ProjectComment[],
  id: string,
): ProjectComment[] {
  return list.map((c) => {
    if (c.id !== id) return c
    const { resolvedAt: _a, resolvedBy: _b, ...rest } = c
    return rest
  })
}

/**
 * Estatísticas rápidas pra mostrar badge nas tabs ("3 abertos").
 */
export function summarizeComments(list: ProjectComment[]): {
  total: number
  open: number
  resolved: number
} {
  let open = 0
  let resolved = 0
  for (const c of list) {
    if (c.resolvedAt) resolved++
    else open++
  }
  return { total: list.length, open, resolved }
}
