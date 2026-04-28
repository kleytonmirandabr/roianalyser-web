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

const NAME_DESC_FIELDS: CatalogFieldDef[] = [
  {
    key: 'name',
    label: 'Nome',
    kind: 'text',
    required: true,
    showInTable: true,
  },
  {
    key: 'description',
    label: 'Descrição',
    kind: 'text',
    showInTable: true,
  },
]

const NAME_DESC_ORDER_FIELDS: CatalogFieldDef[] = [
  ...NAME_DESC_FIELDS,
  {
    key: 'order',
    label: 'Ordem',
    kind: 'number',
    showInTable: true,
    width: '6rem',
    defaultValue: 0,
  },
]


export const CATALOG_REGISTRY: CatalogDef[] = [
  {
    slug: 'lead-sources',
    type: 'leadSources',
    label: 'Fontes de Lead',
    description: 'Origens de leads/oportunidades para registro no CRM.',
    group: 'crm',
    ready: true,
    fields: NAME_DESC_FIELDS,
  },
  {
    slug: 'sectors',
    type: 'sectors',
    label: 'Setores',
    description: 'Setores/segmentos de atuação dos clientes.',
    group: 'crm',
    ready: true,
    fields: NAME_DESC_FIELDS,
  },
  {
    slug: 'item-categories',
    type: 'itemCategories',
    label: 'Categorias de Item',
    description: 'Categorias do catálogo de itens.',
    group: 'items',
    ready: true,
    fields: NAME_DESC_ORDER_FIELDS,
  },
  {
    slug: 'billing-units',
    type: 'billingUnits',
    label: 'Unidades de Cobrança',
    description: 'Unidades (hora, mês, licença).',
    group: 'items',
    ready: true,
    fields: NAME_DESC_FIELDS,
  },
  {
    slug: 'financial-types',
    type: 'financialTypes',
    label: 'Tipos Financeiros',
    description:
      'Classificação financeira (Entrada/Saída/Investimento). É a FONTE DA VERDADE pro motor: define se itens deste tipo afetam receita, custo ou investimento.',
    group: 'items',
    ready: true,
    fields: [
      ...NAME_DESC_FIELDS,
      {
        key: 'affectsRevenue',
        label: 'Afeta receita',
        kind: 'boolean',
        showInTable: true,
        width: '7rem',
        defaultValue: false,
      },
      {
        key: 'affectsCost',
        label: 'Afeta custo',
        kind: 'boolean',
        showInTable: true,
        width: '7rem',
        defaultValue: false,
      },
      {
        key: 'affectsInvestment',
        label: 'Afeta investimento',
        kind: 'boolean',
        showInTable: true,
        width: '7rem',
        defaultValue: false,
      },
    ],
  },
  {
    slug: 'user-groups',
    type: 'userGroups',
    label: 'Grupos de Usuários',
    description: 'Agrupamentos para permissionamento.',
    group: 'people',
    ready: true,
    fields: NAME_DESC_FIELDS,
  },
  {
    slug: 'companies',
    type: 'companies',
    label: 'Empresas',
    description: 'Empresas clientes e parceiros — endereço e redes sociais.',
    group: 'crm',
    ready: true,
    fields: [
      { key: 'name', label: 'Nome', kind: 'text', required: true, showInTable: true },
      { key: 'employeeCount', label: 'Nº de funcionários', kind: 'number' },
      { key: 'sectorId', label: 'Setor', kind: 'catalogRef', refCatalog: 'sectors', showInTable: true },
      { key: 'country', label: 'País', kind: 'text' },
      { key: 'state', label: 'Estado', kind: 'text', showInTable: true, width: '5rem' },
      { key: 'city', label: 'Cidade', kind: 'text', showInTable: true },
      { key: 'district', label: 'Bairro', kind: 'text' },
      { key: 'street', label: 'Rua', kind: 'text' },
      { key: 'number', label: 'Número', kind: 'text' },
      { key: 'complement', label: 'Complemento', kind: 'text' },
      { key: 'cep', label: 'CEP', kind: 'cep', placeholder: '00000-000' },
      { key: 'linkedin', label: 'LinkedIn', kind: 'text' },
      { key: 'instagram', label: 'Instagram', kind: 'text' },
    ],
  },
  {
    slug: 'contacts',
    type: 'contacts',
    label: 'Contatos',
    description: 'Pessoas vinculadas a empresas — comercial, técnico, etc.',
    group: 'crm',
    ready: true,
    fields: [
      { key: 'name', label: 'Nome', kind: 'text', required: true, showInTable: true },
      { key: 'role', label: 'Cargo', kind: 'text', showInTable: true },
      { key: 'email', label: 'E-mail', kind: 'text', showInTable: true, placeholder: 'pessoa@empresa.com' },
      { key: 'phone', label: 'Telefone', kind: 'text', showInTable: true, placeholder: '(11) 99999-0000' },
      { key: 'companyId', label: 'Empresa', kind: 'catalogRef', refCatalog: 'companies', showInTable: true },
      { key: 'linkedin', label: 'LinkedIn', kind: 'text' },
      { key: 'notes', label: 'Observações', kind: 'text' },
    ],
  },
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
  {
    slug: 'sales-goals',
    type: 'salesGoals',
    label: 'Metas de Vendas',
    description: 'Metas por período e responsável.',
    group: 'crm',
    ready: true,
    fields: [
      { key: 'name', label: 'Nome', kind: 'text', required: true, showInTable: true },
      { key: 'description', label: 'Descrição', kind: 'text' },
      { key: 'target', label: 'Meta', kind: 'number', showInTable: true, width: '8rem' },
    ],
  },
  {
    slug: 'catalog-items',
    type: 'catalogItems',
    label: 'Itens do Catálogo',
    description:
      'Itens base reutilizáveis (HW, software, mob., capex, cogs, serviços). Pré-preenche valores nas views financeiras.',
    group: 'items',
    ready: true,
    fields: [
      { key: 'name', label: 'Nome', kind: 'text', required: true, showInTable: true },
      { key: 'code', label: 'Código', kind: 'text', showInTable: true, width: '8rem' },
      { key: 'cat', label: 'Categoria (cat)', kind: 'text', showInTable: true, width: '6rem', placeholder: 'hw, sw, mob, capex, cogs' },
      { key: 'desc', label: 'Descrição', kind: 'text' },
      { key: 'unit', label: 'Unidade', kind: 'text', placeholder: 'unid, mês, hora' },
      { key: 'categoryId', label: 'Categoria', kind: 'catalogRef', refCatalog: 'itemCategories' },
      { key: 'groupKey', label: 'Group key', kind: 'text' },
      { key: 'billingUnitId', label: 'Unidade de cobrança', kind: 'catalogRef', refCatalog: 'billingUnits' },
      { key: 'financialTypeId', label: 'Tipo financeiro', kind: 'catalogRef', refCatalog: 'financialTypes' },
      { key: 'entryBehavior', label: 'Comportamento', kind: 'text', placeholder: 'amortized, recurring' },
      { key: 'calculationMode', label: 'Modo de cálculo', kind: 'text', placeholder: 'amortized' },
      { key: 'valHw', label: 'Valor HW', kind: 'number' },
      { key: 'valMob', label: 'Valor Mobilização', kind: 'number' },
      { key: 'defaultValue', label: 'Valor padrão', kind: 'number' },
      { key: 'defaultDurationMonths', label: 'Duração padrão (meses)', kind: 'number' },
      { key: 'defaultInstallments', label: 'Parcelas padrão', kind: 'number' },
      { key: 'defaultStartMonth', label: 'Mês de início padrão', kind: 'number' },
      { key: 'allowsQuantity', label: 'Permite quantidade', kind: 'boolean' },
      { key: 'allowsDiscountPct', label: 'Permite desconto %', kind: 'boolean' },
      { key: 'allowsInstallments', label: 'Permite parcelas', kind: 'boolean' },
      { key: 'allowsDurationMonths', label: 'Permite duração em meses', kind: 'boolean' },
      { key: 'allowsStartMonth', label: 'Permite mês de início', kind: 'boolean' },
      { key: 'affectsRevenue', label: 'Afeta receita', kind: 'boolean' },
      { key: 'affectsCost', label: 'Afeta custo', kind: 'boolean' },
      { key: 'affectsInvestment', label: 'Afeta investimento', kind: 'boolean' },
    ],
  },
  {
    slug: 'contract-form-fields',
    type: 'contractFormFields',
    label: 'Campos do Contrato',
    description:
      'Quais campos aparecem no formulário de novo contrato/projeto. Toggle de visibilidade e obrigatoriedade.',
    group: 'project',
    ready: true,
    // Consolidado em /admin/contract-form (Form. da Oportunidade).
    hidden: true,
    fields: [
      { key: 'id', label: 'ID do campo', kind: 'text', required: true, showInTable: true },
      { key: 'labelKey', label: 'Chave i18n', kind: 'text', showInTable: true },
      { key: 'visible', label: 'Visível', kind: 'boolean', showInTable: true, width: '6rem' },
      { key: 'required', label: 'Obrigatório', kind: 'boolean', showInTable: true, width: '7rem' },
    ],
  },
  {
    slug: 'custom-fields',
    type: 'customFields',
    label: 'Campos Customizados',
    description:
      'Campos extras criados pelo tenant para aparecerem nos formulários (projeto, empresa, contato). Nome, chave técnica, tipo e flags de obrigatório/visível.',
    group: 'project',
    ready: true,
    // Consolidado em /admin/contract-form (Form. da Oportunidade).
    hidden: true,
    fields: [
      { key: 'name', label: 'Nome', kind: 'text', required: true, showInTable: true },
      {
        key: 'fieldKey',
        label: 'Chave técnica',
        kind: 'text',
        required: true,
        showInTable: true,
        width: '10rem',
        placeholder: 'snake_case_only',
      },
      {
        key: 'fieldType',
        label: 'Tipo',
        kind: 'text',
        showInTable: true,
        width: '8rem',
        placeholder: 'text, number, currency, percent, date, select, multi-select, checkbox, color, link',
        defaultValue: 'text',
      },
      {
        key: 'options',
        label: 'Opções (select)',
        kind: 'text',
        placeholder: 'Alta | Média | Baixa',
      },
      { key: 'required', label: 'Obrigatório', kind: 'boolean', showInTable: true, width: '7rem' },
      { key: 'visible', label: 'Visível', kind: 'boolean', showInTable: true, width: '6rem', defaultValue: true },
    ],
  },
]

export function findCatalogBySlug(slug: string): CatalogDef | undefined {
  return CATALOG_REGISTRY.find((c) => c.slug === slug)
}
