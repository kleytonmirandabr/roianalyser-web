/**
 * Tipos compartilhados da tabela de tarefas.
 * Mantidos separados para evitar imports circulares e reduzir contexto por arquivo.
 */
import type { MilestoneKind, ProjectMilestone } from '@/features/projects2/milestones-types'
import type { ProjectTaskColumn, TaskColumnValue } from '@/features/projects2/task-columns-types'

// ─── Usuário mini ─────────────────────────────────────────────────────────────
export interface UserMini { id: string; name: string; email: string }

// ─── Ordenação ────────────────────────────────────────────────────────────────
export interface TableSort { key: string; dir: 'asc' | 'desc' }

// ─── Filtro por coluna ────────────────────────────────────────────────────────
export type ColFilter =
  | { kind: 'text';   contains: string }
  | { kind: 'select'; values: string[] }
  | { kind: 'date';   from: string; to: string }
  | { kind: 'number'; op: 'eq' | 'lt' | 'gt' | 'lte' | 'gte'; val: string }
  | { kind: 'people'; ids: string[] }
  | { kind: 'bool';   checked: boolean | null }

export type FilterKind = 'text' | 'select' | 'date' | 'number' | 'people' | 'bool'

// ─── Definição de coluna da tabela ────────────────────────────────────────────
export interface Column {
  key: string
  label: string
  width: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  colId?: string
}

// ─── Estado de criação inline ─────────────────────────────────────────────────
export interface InlineCreate {
  kind: MilestoneKind
  parentId: string | null
  groupId: string | null
}

// ─── Tipos de linha flat ──────────────────────────────────────────────────────
export interface FlatRow   { _type: 'task';   task: ProjectMilestone; level: 0|1|2; groupId?: string }
export interface AddRow    { _type: 'add';    groupId: string | null }
export interface FooterRow { _type: 'footer'; groupId: string; total: number; done: number; avgPct: number }
export interface AddGroup  { _type: 'add-group' }
export type Row = FlatRow | AddRow | FooterRow | AddGroup

// ─── Props do componente principal ───────────────────────────────────────────
export interface TasksTableViewProps {
  items: ProjectMilestone[]
  customCols: ProjectTaskColumn[]
  valuesByTaskCol: Record<string, Record<string, TaskColumnValue>>
  users: UserMini[]
  canEdit: boolean
  collapsed: Set<string>
  onToggleCollapse: (id: string) => void
  onUpdateTask: (id: string, patch: any) => void
  onDeleteTask: (m: ProjectMilestone) => void
  onCreateTask: (kind: MilestoneKind, parentId: string | null, title: string) => Promise<void>
  onReorderGroup: (groupId: string | null, orderedIds: string[]) => void
  onPutColumnValue: (taskId: string, colId: string, value: any) => void
  onOpenColumnsManager: () => void
  onRenameColumn?: (colId: string, newLabel: string) => void
  onDeleteColumn?: (colId: string) => void
  subtaskCount: Record<string, number>
  createRequest?: { kind: MilestoneKind } | null
  onCreateRequestConsumed?: () => void
}
