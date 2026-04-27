/**
 * Registry central dos campos exibíveis/filtráveis de um Projeto.
 *
 * UM lugar só define todos os campos possíveis (nome, cliente, valor,
 * datas, responsável, customizados…) com:
 *   - rótulo
 *   - tipo (text/number/date/select)
 *   - extrator (`getValue`) pra ordenar/filtrar
 *   - renderer opcional pra exibir na célula da tabela
 *
 * Esse registry serve as duas features:
 *   - Colunas configuráveis na Lista (#4) — user escolhe quais aparecem
 *   - Filtros avançados (#5) — user escolhe campo + operador + valor
 *
 * Pra adicionar um campo novo, basta um item aqui e ele aparece nas
 * duas UIs automaticamente.
 */

import type { Project } from '@/features/projects/types'

export type ProjectFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean'

export type ProjectField = {
  /** Identificador único do campo (estável — usado em localStorage). */
  key: string
  /** Rótulo exibido no header da coluna e no dropdown de filtros. */
  label: string
  /** Tipo do valor — controla operadores disponíveis no filtro. */
  type: ProjectFieldType
  /**
   * Extrai o valor scalar pra sort/filtro/exibição. Default null/undefined
   * vira "—" no display e "vazio" nos filtros.
   */
  getValue: (project: Project) => string | number | boolean | null | undefined
  /**
   * Render opcional pra célula da tabela. Default = String(getValue()).
   * Use pra formatar moeda, badges de status, etc.
   */
  render?: (project: Project) => string
  /** Coluna habilitada por padrão na Lista. */
  defaultEnabled?: boolean
  /** Pode ser desligada? Default true. `name` é sempre obrigatória. */
  removable?: boolean
}

function payloadString(p: Project, key: string): string | null {
  const v = (p.payload as Record<string, unknown> | null | undefined)?.[key]
  return typeof v === 'string' && v ? v : null
}

function topLevelString(p: Project, key: string): string | null {
  const v = (p as unknown as Record<string, unknown>)[key]
  return typeof v === 'string' && v ? v : null
}

/**
 * Lista canônica dos campos disponíveis num projeto. A ordem aqui também
 * é a ordem default das colunas na Lista (se o user não personalizou).
 */
export const PROJECT_FIELDS: ProjectField[] = [
  {
    key: 'name',
    label: 'Nome',
    type: 'text',
    getValue: (p) => p.name,
    defaultEnabled: true,
    removable: false,
  },
  {
    key: 'clientName',
    label: 'Cliente',
    type: 'text',
    getValue: (p) =>
      topLevelString(p, 'clientName') ?? payloadString(p, 'clientName') ?? '',
    defaultEnabled: true,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    getValue: (p) => p.status ?? '',
    defaultEnabled: true,
  },
  {
    key: 'responsible',
    label: 'Responsável',
    type: 'text',
    getValue: (p) => payloadString(p, 'responsible') ?? '',
    defaultEnabled: true,
  },
  {
    key: 'currency',
    label: 'Moeda',
    type: 'text',
    getValue: (p) => p.currency ?? '',
    defaultEnabled: true,
  },
  {
    key: 'startDate',
    label: 'Início',
    type: 'date',
    getValue: (p) => payloadString(p, 'startDate') ?? '',
    defaultEnabled: false,
  },
  {
    key: 'endDate',
    label: 'Encerramento',
    type: 'date',
    getValue: (p) => payloadString(p, 'endDate') ?? '',
    defaultEnabled: false,
  },
  {
    key: 'contractType',
    label: 'Tipo de contrato',
    type: 'select',
    getValue: (p) => payloadString(p, 'contractType') ?? '',
    defaultEnabled: false,
  },
  {
    key: 'clientState',
    label: 'Estado (UF)',
    type: 'select',
    getValue: (p) => payloadString(p, 'clientState') ?? '',
    defaultEnabled: false,
  },
  {
    key: 'createdAt',
    label: 'Criado em',
    type: 'date',
    getValue: (p) => p.createdAt ?? '',
    defaultEnabled: false,
  },
  {
    key: 'updatedAt',
    label: 'Atualizado em',
    type: 'date',
    getValue: (p) => p.updatedAt ?? '',
    defaultEnabled: true,
  },
  {
    key: 'active',
    label: 'Ativo',
    type: 'boolean',
    getValue: (p) => p.active !== false,
    defaultEnabled: false,
  },
]

export const PROJECT_FIELDS_BY_KEY: Record<string, ProjectField> = Object.fromEntries(
  PROJECT_FIELDS.map((f) => [f.key, f]),
)

export function getDefaultEnabledKeys(): string[] {
  return PROJECT_FIELDS.filter((f) => f.defaultEnabled).map((f) => f.key)
}

/* ========================================================================
 * Filtros avançados — operadores, validação e função apply.
 * ======================================================================== */

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'empty'
  | 'notEmpty'

export type Filter = {
  /** Identificador único da instância do filtro (UI tracking). */
  id: string
  fieldKey: string
  operator: FilterOperator
  /** Valor primário (operadores 1-arg). */
  value: string
  /** Valor secundário (only `between`: from–to). */
  value2?: string
}

/**
 * Operadores válidos por tipo de campo. Usado pra popular o dropdown
 * de operadores na UI de filtros.
 */
export const OPERATORS_BY_TYPE: Record<ProjectFieldType, FilterOperator[]> = {
  text: ['contains', 'notContains', 'eq', 'neq', 'empty', 'notEmpty'],
  select: ['eq', 'neq', 'empty', 'notEmpty'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notEmpty'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notEmpty'],
  boolean: ['eq', 'neq'],
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'igual a',
  neq: 'diferente de',
  contains: 'contém',
  notContains: 'não contém',
  gt: 'maior que',
  gte: 'maior ou igual',
  lt: 'menor que',
  lte: 'menor ou igual',
  between: 'entre',
  empty: 'está vazio',
  notEmpty: 'não está vazio',
}

function compareValues(
  fieldType: ProjectFieldType,
  raw: unknown,
  filter: Filter,
): boolean {
  const op = filter.operator
  const v = filter.value
  const v2 = filter.value2 ?? ''

  // Operadores de presença — independem do tipo.
  if (op === 'empty') {
    return raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)
  }
  if (op === 'notEmpty') {
    return raw != null && raw !== '' && !(Array.isArray(raw) && raw.length === 0)
  }

  // Comparação numérica/data: parse explícito.
  if (fieldType === 'number' || fieldType === 'date') {
    const a =
      fieldType === 'date'
        ? Date.parse(String(raw ?? '')) || 0
        : Number(raw ?? 0)
    const b = fieldType === 'date' ? Date.parse(v) || 0 : Number(v)
    const c = fieldType === 'date' ? Date.parse(v2) || 0 : Number(v2)
    switch (op) {
      case 'eq':
        return a === b
      case 'neq':
        return a !== b
      case 'gt':
        return a > b
      case 'gte':
        return a >= b
      case 'lt':
        return a < b
      case 'lte':
        return a <= b
      case 'between':
        return a >= b && a <= c
      default:
        return true
    }
  }

  // Boolean.
  if (fieldType === 'boolean') {
    const a = !!raw
    const b = v === 'true' || v === '1' || v === 'sim'
    return op === 'eq' ? a === b : a !== b
  }

  // Texto / select — case-insensitive.
  const a = String(raw ?? '').toLowerCase()
  const b = v.toLowerCase()
  switch (op) {
    case 'eq':
      return a === b
    case 'neq':
      return a !== b
    case 'contains':
      return a.includes(b)
    case 'notContains':
      return !a.includes(b)
    default:
      return true
  }
}

/** Aplica array de filtros (AND) a uma lista de projetos. */
export function applyFilters(projects: Project[], filters: Filter[]): Project[] {
  if (filters.length === 0) return projects
  return projects.filter((p) =>
    filters.every((f) => {
      const def = PROJECT_FIELDS_BY_KEY[f.fieldKey]
      if (!def) return true // filtro órfão — ignora
      const raw = def.getValue(p)
      return compareValues(def.type, raw, f)
    }),
  )
}

/** Cria um filtro novo com defaults razoáveis pro tipo do campo. */
export function newFilter(fieldKey: string): Filter {
  const def = PROJECT_FIELDS_BY_KEY[fieldKey] ?? PROJECT_FIELDS[0]
  const ops = OPERATORS_BY_TYPE[def.type]
  return {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fieldKey: def.key,
    operator: ops[0],
    value: '',
  }
}
