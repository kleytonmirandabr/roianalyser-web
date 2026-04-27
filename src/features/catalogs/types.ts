/**
 * Tipo "âncora" de um item de catálogo. Cada catálogo específico estende com
 * seus próprios campos. Espelha o que vem nas rotas
 * `/api/catalogs/:clientId/:catalogType[/:itemId]` do backend.
 */
export type CatalogItem = {
  id: string
  name?: string
  code?: string
  description?: string
  color?: string
  order?: number
  active?: boolean
  /** Permitir campos extras específicos de cada catálogo. */
  [key: string]: unknown
}

/** Identificadores aceitos pelo backend (CATALOG_TYPE_MAP em catalog-routes.js). */
export type CatalogType =
  | 'sectors'
  | 'companies'
  | 'contacts'
  | 'leadSources'
  | 'contractTypes'
  | 'financialTypes'
  | 'itemCategories'
  | 'billingUnits'
  | 'catalogItems'
  | 'catalogCapex'
  | 'catalogCogs'
  | 'catalogSvcs'
  | 'taskCatalogs'
  | 'projectStatuses'
  | 'contractFormFields'
  | 'salesGoals'
  | 'userGroups'
  | 'plans'
  | 'customFields'
