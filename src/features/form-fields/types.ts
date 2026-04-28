/**
 * Tipos de Form Fields (custom fields configuráveis por tenant).
 *
 * Define campos extras por escopo (opportunity/roi/contract/project) que
 * são renderizados no detalhe das entidades. O backend mantém os valores
 * em `form_field_values` (polimórfico via entity_type + entity_id).
 *
 * Spec: PLAN_split-domain-entities.md, seção 2.3.
 */

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multiselect'

export type FormFieldScope = 'opportunity' | 'roi' | 'contract' | 'project'

export const FORM_FIELD_SCOPES: FormFieldScope[] = [
  'opportunity',
  'roi',
  'contract',
  'project',
]

export const FORM_FIELD_TYPES: FormFieldType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'boolean',
  'select',
  'multiselect',
]

export const SCOPE_LABELS: Record<FormFieldScope, string> = {
  opportunity: 'Oportunidade',
  roi: 'Análise ROI',
  contract: 'Contrato',
  project: 'Projeto',
}

export const TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  date: 'Data',
  boolean: 'Sim/Não',
  select: 'Seleção única',
  multiselect: 'Múltipla escolha',
}

/**
 * EntityType usado nas rotas /api/form-field-values/:entityType/:entityId.
 * Diferente do scope porque ROI usa entity_type='roi_analysis'.
 */
export type FormFieldEntityType = 'opportunity' | 'roi_analysis' | 'contract' | 'project'

export const SCOPE_TO_ENTITY_TYPE: Record<FormFieldScope, FormFieldEntityType> = {
  opportunity: 'opportunity',
  roi: 'roi_analysis',
  contract: 'contract',
  project: 'project',
}

export interface FormField {
  id: string
  tenantId: string
  scope: FormFieldScope
  fieldKey: string
  label: string
  fieldType: FormFieldType
  /** Para select/multiselect: lista de opções `{value, label}`. */
  options: { value: string; label: string }[] | null
  required: boolean
  displayOrder: number
  helpText: string | null
  createdAt: string
  updatedAt: string
}

export interface FormFieldValue {
  field: FormField
  /** Tipo do value depende de field.fieldType (string/number/Date/boolean/string[]). */
  value: unknown
}

export interface CreateFormFieldInput {
  scope: FormFieldScope
  fieldKey: string
  label: string
  fieldType: FormFieldType
  options?: { value: string; label: string }[]
  required?: boolean
  displayOrder?: number
  helpText?: string | null
  tenantId?: string
}

export interface UpdateFormFieldInput {
  label?: string
  helpText?: string | null
  required?: boolean
  displayOrder?: number
  options?: { value: string; label: string }[]
}

export interface SetFormFieldValueInput {
  fieldId: string
  value: unknown
}
