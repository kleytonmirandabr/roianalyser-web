/**
 * Tipos de Colunas Custom Monday-style (Phase 2 P.4).
 *
 * Suportados pelo backend: 15 tipos. Frontend aborda 9 tipos comuns:
 * text, number, currency, percent, date, select, checkbox, link, status.
 */

export type ColumnType =
  | 'text' | 'long_text' | 'number' | 'currency' | 'percent'
  | 'date' | 'date_range' | 'select' | 'multiselect' | 'people'
  | 'rating' | 'status' | 'progress' | 'link' | 'checkbox'

export const COLUMN_TYPE_LABELS: Partial<Record<ColumnType, string>> = {
  text: 'Texto curto',
  long_text: 'Texto longo',
  number: 'Numero',
  currency: 'Moeda',
  percent: 'Percentual',
  date: 'Data',
  date_range: 'Periodo',
  select: 'Selecao unica',
  multiselect: 'Selecao multipla',
  people: 'Pessoas',
  rating: 'Avaliacao 1-5',
  status: 'Status',
  progress: 'Progresso 0-100',
  link: 'Link/URL',
  checkbox: 'Checkbox',
}

export const SUPPORTED_COLUMN_TYPES: ColumnType[] = [
  'text', 'number', 'currency', 'percent',
  'date', 'select', 'checkbox', 'link', 'status',
]

export interface ProjectTaskColumn {
  id: string
  projectId: string
  columnKey: string
  label: string
  type: ColumnType
  options: { values?: Array<{ value: string; label: string; color?: string }> } | null
  required: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateColumnInput {
  columnKey?: string
  label: string
  type: ColumnType
  options?: ProjectTaskColumn['options']
  required?: boolean
  displayOrder?: number
}

export type UpdateColumnInput = Partial<CreateColumnInput>

export interface TaskColumnValue {
  id: string
  taskId: string
  columnId: string
  value: any
  updatedAt: string
  updatedBy: string | null
}
