export type AggregationFn = 'count' | 'sum' | 'avg' | 'min' | 'max'
export type SortDir = 'asc' | 'desc'
export type ChartType = 'bar' | 'line' | 'pie' | 'table' | 'kpi'
export type FieldType = 'string' | 'number' | 'date'

export interface AnalyticsField {
  key: string
  label: string
  type: FieldType
}

export interface AnalyticsDataset {
  key: string
  label: string
  fields: AnalyticsField[]
}

export type FilterOperator =
  | 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'in' | 'notnull' | 'isnull'

export interface QueryFilter {
  field: string
  operator: FilterOperator
  value?: string | number | string[]
}

export interface AnalyticsQuery {
  dataset: string
  fields?: string[]
  filters?: QueryFilter[]
  groupBy?: string
  valueField?: string
  aggregation?: AggregationFn
  sortField?: string
  sortDir?: SortDir
  limit?: number
}

export interface QueryResultRow {
  [key: string]: string | number | null | undefined
}

export interface QueryResult {
  columns: Array<{ key: string; label: string; type: FieldType }>
  rows: QueryResultRow[]
  total: number
}

export interface AnalyticsReport {
  id: number
  name: string
  dataset: string
  config: ReportConfig
  created_at: string
  updated_at: string
}

export interface ReportConfig {
  chartType: ChartType
  query: AnalyticsQuery
  /** KPI: which field to show as big number */
  kpiField?: string
  kpiLabel?: string
  color?: string
}
