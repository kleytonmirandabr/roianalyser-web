import { api } from '@/shared/api/client'

import type { CatalogItem, CatalogType } from './types'

/**
 * Em todas as chamadas, `clientId` vem do `user.clientId` da sessão atual.
 * O backend impõe enforceTenant: usuários não-master só conseguem operar
 * sobre o próprio clientId.
 */
export const catalogsApi = {
  list: (clientId: string, type: CatalogType) =>
    api
      .get<{ items: CatalogItem[] } | CatalogItem[]>(
        `/catalogs/${encodeURIComponent(clientId)}/${type}`,
      )
      .then((response) => normalizeListResponse(response)),

  create: (clientId: string, type: CatalogType, input: Partial<CatalogItem>) =>
    api
      .post<{ item: CatalogItem } | CatalogItem>(
        `/catalogs/${encodeURIComponent(clientId)}/${type}`,
        input,
      )
      .then((response) => normalizeItemResponse(response)),

  update: (
    clientId: string,
    type: CatalogType,
    id: string,
    input: Partial<CatalogItem>,
  ) =>
    api
      .put<{ item: CatalogItem } | CatalogItem>(
        `/catalogs/${encodeURIComponent(clientId)}/${type}/${encodeURIComponent(id)}`,
        input,
      )
      .then((response) => normalizeItemResponse(response)),

  delete: (clientId: string, type: CatalogType, id: string) =>
    api.delete<void>(
      `/catalogs/${encodeURIComponent(clientId)}/${type}/${encodeURIComponent(id)}`,
    ),
}

/**
 * O backend pode devolver `{items:[...]}` ou um array direto, dependendo do
 * tipo de catálogo. Normalizamos para sempre devolver array.
 */
function normalizeListResponse(
  response: { items: CatalogItem[] } | CatalogItem[],
): CatalogItem[] {
  if (Array.isArray(response)) return response
  if (response && Array.isArray((response as { items: CatalogItem[] }).items)) {
    return (response as { items: CatalogItem[] }).items
  }
  return []
}

function normalizeItemResponse(
  response: { item: CatalogItem } | CatalogItem,
): CatalogItem {
  if (response && typeof response === 'object' && 'item' in response) {
    return (response as { item: CatalogItem }).item
  }
  return response as CatalogItem
}
