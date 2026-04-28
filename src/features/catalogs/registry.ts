import type { CatalogType } from './types'

/**
 * Registry de catálogos: define o que aparece na lista e o slug usado nas
 * rotas `/catalogs/:slug` do front. O slug pode ser diferente do tipo do
 * backend para deixar a URL mais amigável (ex: /catalogs/lead-sources).
 */
export type CatalogFieldKind =
  | 'text'
  | 'number'
  | 'color'
  | 'boolean'
  | 'cep'
  /** Combobox que puxa itens de outro catálogo (foreign-key amigável). */
  | 'catalogRef'
  /** Combobox com lista FECHADA de opções definidas no registry. */
  | 'enum'

export type CatalogFieldDef = {
  key: string
  label: string
  kind: CatalogFieldKind
  required?: boolean
  /** Mostrar como coluna na tabela. */
  showInTable?: boolean
  /** Largura sugerida da coluna em CSS. */
  width?: string
  /** Placeholder/help. */
  placeholder?: string
  /** Valor padrão ao criar novo item. */
  defaultValue?: string | number | boolean
  /**
   * Quando kind === 'catalogRef': tipo do catálogo cujos itens alimentam
   * o combobox. O valor selecionado é o `id` do item escolhido.
   */
  refCatalog?: CatalogType
  /**
   * Opcional. Quando kind === 'catalogRef': em vez de gravar o id, grava
   * o campo `name` (útil pra catálogos de strings curtas).
   */
  refStoreField?: 'id' | 'name'
  /**
   * Opções fixas pra kind === 'enum'. O Combobox grava `value` (string)
   * e exibe `label`. `value === ''` é tratado como "não definido".
   */
  enumOptions?: ReadonlyArray<{ value: string; label: string }>
}

/**
 * Grupos de contexto pra organizar catálogos na index. Reduz overload visual
 * de uma grade plana de 16 cards e dá pista de onde encontrar cada coisa.
 */
export type CatalogGroup = 'crm' | 'project' | 'items' | 'people'

export type CatalogDef = {
  /** Slug usado em /catalogs/:slug no front. */
  slug: string
  /** Tipo no backend (CatalogType). */
  type: CatalogType
  /** Label legível. */
  label: string
  description: string
  /** Grupo de contexto (default 'project'). */
  group?: CatalogGroup
  /** Implementação completa pronta? */
  ready: boolean
  /** Campos editáveis (no form e na tabela). */
  fields: CatalogFieldDef[]
  /**
   * Esconder da listagem em /catalogs. Usado para catálogos que foram
   * "consolidados" em outra UI (ex: contractFormFields + customFields agora
   * vivem em /admin/contract-form). A rota /catalogs/:slug ainda funciona,
   * pra não quebrar bookmarks, mas o card não aparece no index.
   */
  hidden?: boolean
}




export const CATALOG_REGISTRY: CatalogDef[] = [
  {
    slug: 'plans',
    type: 'plans',
    label: 'Planos',
    description: 'Planos de pagamento/preço para licenças de software.',
    group: 'items',
    ready: true,
    fields: [
      { key: 'name', label: 'Nome', kind: 'text', required: true, showInTable: true },
      { key: 'description', label: 'Descrição', kind: 'text' },
    ],
  },
]

export function findCatalogBySlug(slug: string): CatalogDef | undefined {
  return CATALOG_REGISTRY.find((c) => c.slug === slug)
}
