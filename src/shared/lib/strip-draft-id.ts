/**
 * Pós-migração BIGINT, IDs reais do banco são números. Mas o frontend
 * gera "draft IDs" string (`user_<ts>`, `prof_<ts>`, `client_<ts>` etc.)
 * pra usar como key de UI antes do save — daí precisa stripar antes
 * de mandar pro backend, deixando o DB IDENTITY autogerar o BIGINT real.
 *
 * IDs reais (BIGINT serializado como string pelo driver pg) são puramente
 * numéricos: '1', '42', '1234'. O regex abaixo bate só nos "draft" (com
 * prefixo seguido de underscore).
 */
const DRAFT_ID_RE = /^(user|usr|prof|client|cli|func|plan|rule|ctr|cmp|emp)_/

export function isDraftId(id: unknown): boolean {
  return typeof id === 'string' && DRAFT_ID_RE.test(id)
}

/**
 * Retorna cópia do item sem o campo `id` se for draft. Mantém todos os
 * outros campos. Não modifica o original.
 */
export function stripDraftId<T extends { id?: unknown }>(item: T): T {
  if (!item || !isDraftId(item.id)) return item
  const { id: _drop, ...rest } = item as Record<string, unknown>
  return rest as T
}

/**
 * Aplica `stripDraftId` em um array. Útil pra preparar payload de
 * `patch.mutateAsync({ users: stripDraftIds(next) })`.
 */
export function stripDraftIds<T extends { id?: unknown }>(items: T[]): T[] {
  return items.map(stripDraftId)
}
