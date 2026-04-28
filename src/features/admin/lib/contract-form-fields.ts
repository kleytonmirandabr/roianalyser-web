/**
 * Modelo unificado dos campos do "Formulário da Oportunidade".
 *
 * Combina dois catálogos do backend:
 *   - `contractFormFields` — manifesto ordenado: `[{id, visible, required}]`
 *     Entradas com id começando com `custom_` referenciam customFields.
 *     Entradas com id "padrão" são fixas (do vanilla, herdadas via paridade).
 *   - `customFields` — metadata dos customs: `{id, name, fieldKey, fieldType,
 *     options, visible, required}`
 *
 * Esse arquivo expõe a lista canônica dos 17 campos PADRÃO (com tradução PT
 * inline pra evitar dependência de i18n no admin), helpers pra mesclar/dividir
 * entre as duas estruturas e tipos compartilhados.
 *
 * Filosofia: a UI usa o `UnifiedField` (struct combinado). Quando salva,
 * `splitForBackend` separa de volta em (contractFormFields, customFields)
 * pra mandar pra API. Zero migração de dados.
 */

import type { CustomFieldType } from '@/features/catalogs/components/custom-field-renderer'

/**
 * Onde o valor do campo padrão é gravado no projeto:
 * - `name` / `status` / `currency` → top-level do contrato (campo nativo)
 * - `payload` → dentro do payload JSON (chave = `payloadKey` ou `id`)
 */
export type FieldStorage = 'name' | 'status' | 'currency' | 'payload'

/**
 * Como o campo padrão é renderizado no form de criação/edição:
 * - text/textarea/email/phone → Input variantes
 * - number/percent/currency → Input number (com step apropriado)
 * - date → Input date
 * - combobox-status → Combobox alimentado pelo catálogo `projectStatuses`
 * - combobox-currency → Combobox de moedas ISO 4217
 * - catalogRef → Combobox de algum catálogo (definido em `refCatalog`)
 */
export type FieldRenderType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'percent'
  | 'currency'
  | 'date'
  | 'combobox-status'
  | 'combobox-currency'
  | 'catalogRef'

/** Campos padrão herdados do vanilla — não podem ser deletados nem editados em nome/tipo. */
export type StandardFieldDef = {
  id: string
  /** Rótulo exibido no admin e nos formulários (PT-BR). */
  label: string
  /** Visível por padrão? */
  defaultVisible: boolean
  /** Obrigatório por padrão? */
  defaultRequired: boolean
  /** Não permite desativar visibilidade nem mexer em obrigatoriedade. Cobre `projectName`, `projectOwner`, `projectClient`, `projectStatus` (lista LOCKED_FIELDS do vanilla). */
  locked?: boolean
  /** Como gravar no projeto. Default: payload com chave = id. */
  storage: FieldStorage
  /** Quando storage='payload', chave dentro do payload (default = id). */
  payloadKey?: string
  /** Tipo de input. Default 'text'. */
  renderType: FieldRenderType
  /** Quando renderType='catalogRef', qual catálogo alimenta o combobox. */
  refCatalog?: 'leadSources' | 'contractTypes' | 'companies'
  /** Placeholder do input. */
  placeholder?: string
  /** Em formulários grid, ocupar 2 colunas? Default false. */
  fullWidth?: boolean
}

export const STANDARD_FIELDS: StandardFieldDef[] = [
  { id: 'projectName', label: 'Nome do Projeto', defaultVisible: true, defaultRequired: true, locked: true, storage: 'name', renderType: 'text', fullWidth: true },
  // Responsável: auto-fill com user logado em new.tsx (default no useState).
  // Texto editável só pra master/admin sobrescrever; users comuns ficam com o próprio nome.
  { id: 'projectOwner', label: 'Responsável', defaultVisible: true, defaultRequired: false, locked: true, storage: 'payload', payloadKey: 'responsible', renderType: 'text' },
  // 'projectClient' (Cliente) REMOVIDO em 2026-04-28: redundante com tenant ativo
  // do switcher; diag em prod confirmou 0 contratos com payloadKey='clientName'
  // preenchido. Empresa-alvo da venda usa o campo `contractCompanyId` (catálogo
  // Empresas). O backend já injeta tenantId via resolveTenantId(user) no POST.
  { id: 'projectStatus', label: 'Status', defaultVisible: true, defaultRequired: false, locked: true, storage: 'status', renderType: 'combobox-status' },
  { id: 'projectCurrency', label: 'Moeda', defaultVisible: true, defaultRequired: false, storage: 'currency', renderType: 'combobox-currency' },
  { id: 'contractOpportunityName', label: 'Nome da Oportunidade', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'text', fullWidth: true },
  { id: 'contractLeadSourceId', label: 'Origem do Lead', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'catalogRef', refCatalog: 'leadSources' },
  { id: 'contractTypeId', label: 'Tipo de Contrato', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'catalogRef', refCatalog: 'contractTypes' },
  { id: 'contractCompanyId', label: 'Empresa', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'catalogRef', refCatalog: 'companies' },
  { id: 'contractTermMonths', label: 'Prazo (meses)', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'number' },
  { id: 'contractAmount', label: 'Valor do Contrato', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'currency' },
  { id: 'contractProbability', label: 'Probabilidade (%)', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'percent' },
  { id: 'contractContactName', label: 'Nome do Contato', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'text' },
  { id: 'contractContactEmail', label: 'E-mail do Contato', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'email', placeholder: 'pessoa@empresa.com' },
  { id: 'contractContactPhone', label: 'Telefone do Contato', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'phone', placeholder: '(11) 99999-0000' },
  { id: 'contractCloseForecast', label: 'Previsão de Fechamento', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'date' },
  { id: 'contractNotes', label: 'Observações', defaultVisible: true, defaultRequired: false, storage: 'payload', renderType: 'textarea', fullWidth: true },
]

export const STANDARD_FIELDS_BY_ID: Record<string, StandardFieldDef> = Object.fromEntries(
  STANDARD_FIELDS.map((f) => [f.id, f]),
)

/**
 * Tipos de campo customizado disponíveis pro user escolher ao criar.
 * Espelha os tipos suportados pelo `<CustomFieldRenderer>`.
 */
export const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'percent', label: 'Porcentagem (%)' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção (lista)' },
  { value: 'multi-select', label: 'Múltipla seleção' },
  { value: 'checkbox', label: 'Sim/Não (checkbox)' },
  { value: 'color', label: 'Cor' },
  { value: 'link', label: 'Link/URL' },
]

/* ========================================================================
 * Tipos do storage (espelham o que vem do backend) e do struct unificado.
 * ======================================================================== */

/** Item do catálogo `contractFormFields` no backend. */
export type ManifestItem = {
  id: string
  /** Não usado na UI nova — herdado do vanilla pra compatibilidade. */
  labelKey?: string
  visible?: boolean
  required?: boolean
}

/** Item do catálogo `customFields` no backend. */
export type CustomFieldItem = {
  id: string
  name?: string
  fieldKey?: string
  fieldType?: CustomFieldType
  options?: string
  visible?: boolean
  required?: boolean
  /** Default true. Soft-delete via `active=false`. */
  active?: boolean
}

/** Struct unificado usado pela UI do admin (uma linha = um campo, padrão ou custom). */
export type UnifiedField =
  | {
      kind: 'standard'
      id: string
      label: string
      visible: boolean
      required: boolean
      locked: boolean
    }
  | {
      kind: 'custom'
      /** ID do item no catálogo customFields. */
      id: string
      label: string
      fieldKey: string
      fieldType: CustomFieldType
      options: string
      visible: boolean
      required: boolean
    }

/* ========================================================================
 * Mesclagem: backend → UnifiedField[]
 * ======================================================================== */

/**
 * Combina manifesto + customFields em uma lista unificada na ORDEM CORRETA.
 *
 * Ordem resolvida:
 *   1. Itens listados no manifesto, na ordem em que aparecem.
 *   2. Campos padrão que NÃO estão no manifesto (vão pro fim, ordem do registry).
 *   3. Customs que existem em customFields mas NÃO no manifesto (vão pro fim).
 *
 * Defaults pra `visible`/`required`:
 *   - Padrão sem entry no manifesto: usa defaults do registry.
 *   - Custom sem entry no manifesto: usa flags do próprio customFields.
 */
export function mergeFields(
  manifest: ManifestItem[] | null | undefined,
  customs: CustomFieldItem[] | null | undefined,
): UnifiedField[] {
  const manifestList = (manifest ?? []).filter(Boolean)
  const customList = (customs ?? []).filter((c) => c.active !== false)
  const customById = new Map(customList.map((c) => [c.id, c]))

  const out: UnifiedField[] = []
  const seenIds = new Set<string>()

  // 1. Itens do manifesto (mantém ordem).
  for (const m of manifestList) {
    if (seenIds.has(m.id)) continue
    seenIds.add(m.id)
    if (m.id.startsWith('custom_') || customById.has(m.id)) {
      const cf = customById.get(m.id)
      if (!cf) continue // referência órfã (custom deletado) — pula
      out.push({
        kind: 'custom',
        id: cf.id,
        label: cf.name?.trim() || cf.id,
        fieldKey: cf.fieldKey?.trim() || cf.id,
        fieldType: (cf.fieldType ?? 'text') as CustomFieldType,
        options: cf.options ?? '',
        visible: m.visible !== false,
        required: m.required === true,
      })
    } else {
      const std = STANDARD_FIELDS_BY_ID[m.id]
      if (!std) continue // referência inválida
      out.push({
        kind: 'standard',
        id: std.id,
        label: std.label,
        visible: m.visible !== false,
        required: std.locked
          ? std.defaultRequired || m.required === true
          : m.required === true,
        locked: !!std.locked,
      })
    }
  }

  // 2. Padrão sem entry no manifesto → fim, com defaults do registry.
  for (const std of STANDARD_FIELDS) {
    if (seenIds.has(std.id)) continue
    seenIds.add(std.id)
    out.push({
      kind: 'standard',
      id: std.id,
      label: std.label,
      visible: std.defaultVisible,
      required: std.defaultRequired,
      locked: !!std.locked,
    })
  }

  // 3. Customs sem entry no manifesto → fim.
  for (const cf of customList) {
    if (seenIds.has(cf.id)) continue
    seenIds.add(cf.id)
    out.push({
      kind: 'custom',
      id: cf.id,
      label: cf.name?.trim() || cf.id,
      fieldKey: cf.fieldKey?.trim() || cf.id,
      fieldType: (cf.fieldType ?? 'text') as CustomFieldType,
      options: cf.options ?? '',
      visible: cf.visible !== false,
      required: cf.required === true,
    })
  }

  return out
}

/* ========================================================================
 * Divisão: UnifiedField[] → backend
 * ======================================================================== */

/**
 * Quebra a lista unificada de volta em duas estruturas pra persistir:
 *   - manifest: o array ordenado pra `contractFormFields` (compat vanilla)
 *   - customs: array de customFields (só os custom da lista, pra
 *     enviar como PATCH no catálogo customFields)
 *
 * Master pode reordenar PADRÃO + CUSTOM na mesma tabela; a ordem é
 * preservada via posição no manifest.
 */
export function splitForBackend(unified: UnifiedField[]): {
  manifest: ManifestItem[]
  customs: CustomFieldItem[]
} {
  const manifest: ManifestItem[] = unified.map((f) => ({
    id: f.id,
    visible: f.visible,
    required: f.required,
  }))

  const customs: CustomFieldItem[] = unified
    .filter((f): f is Extract<UnifiedField, { kind: 'custom' }> => f.kind === 'custom')
    .map((f) => ({
      id: f.id,
      name: f.label,
      fieldKey: f.fieldKey,
      fieldType: f.fieldType,
      options: f.options || undefined,
      visible: f.visible,
      required: f.required,
      active: true,
    }))

  return { manifest, customs }
}

/** Cria um custom novo com defaults sensatos. */
export function newCustomField(): Extract<UnifiedField, { kind: 'custom' }> {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return {
    kind: 'custom',
    id,
    label: 'Novo campo',
    fieldKey: id,
    fieldType: 'text',
    options: '',
    visible: true,
    required: false,
  }
}
