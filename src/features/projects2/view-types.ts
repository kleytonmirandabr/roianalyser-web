/** Tipos de view suportados no workspace de projeto. */
export type ViewType = 'list' | 'kanban' | 'calendar' | 'gantt' | 'forms' | 'members' | 'docs' | 'dashboard'

/** Views fixas — sempre existem, não podem ser removidas. */
export const FIXED_VIEW_TYPES: ViewType[] = ['list', 'forms', 'members', 'docs']

/** Views configuráveis pelo usuário via wizard. */
export const CONFIGURABLE_VIEW_TYPES: ViewType[] = ['kanban', 'calendar', 'gantt']

export interface ProjectView {
  id: string
  type: ViewType
  name: string
  config: ViewConfig
  position: number
  enabled: boolean
}

// ─── Configs específicas por tipo ────────────────────────────────────────────

export interface KanbanConfig {
  /** Campo de agrupamento das colunas (default: 'status') */
  statusField?: string
  /** Quais statuses mostrar como colunas */
  visibleColumns?: string[]
  /** Campos exibidos no card além do título */
  cardFields?: Array<'assignees' | 'dueDate' | 'progress' | 'description' | 'rating'>
}

export interface CalendarConfig {
  /** Campo de data principal (default: 'dueDate') */
  dateField?: 'dueDate' | 'startDate' | 'createdAt'
  /** Campo para colorir os eventos (default: 'status') */
  colorByField?: 'status' | 'assignee' | 'group'
}

export interface GanttConfig {
  /** Campo de data de início (default: 'dueDate') */
  startField?: 'dueDate' | 'startDate'
  /** Campo de data de fim (opcional) */
  endField?: 'dueDate' | 'startDate' | null
  /** Agrupar tarefas por (default: 'group') */
  groupByField?: 'group' | 'status' | 'assignee' | null
}

export type ViewConfig = KanbanConfig | CalendarConfig | GanttConfig | Record<string, unknown>

// ─── Metadados de exibição por tipo ──────────────────────────────────────────

export interface ViewTypeMeta {
  type: ViewType
  label: string
  description: string
  icon: string   // nome do ícone lucide
  configurable: boolean
  wizardSteps: number
}

export const VIEW_TYPE_META: Record<ViewType, ViewTypeMeta> = {
  list: {
    type: 'list', label: 'Lista', icon: 'ListTodo',
    description: 'Tabela com todas as tarefas, filtros e ordenação.',
    configurable: false, wizardSteps: 0,
  },
  kanban: {
    type: 'kanban', label: 'Kanban', icon: 'LayoutGrid',
    description: 'Board com colunas por status. Arraste tarefas entre colunas.',
    configurable: true, wizardSteps: 2,
  },
  calendar: {
    type: 'calendar', label: 'Calendário', icon: 'CalendarDays',
    description: 'Visualização mensal com tarefas posicionadas por data.',
    configurable: true, wizardSteps: 2,
  },
  gantt: {
    type: 'gantt', label: 'Gantt', icon: 'GanttChart',
    description: 'Linha do tempo com barras por prazo e agrupamento.',
    configurable: true, wizardSteps: 3,
  },
  forms: {
    type: 'forms', label: 'Formulários', icon: 'ClipboardList',
    description: 'Builder de formulários públicos vinculados ao projeto.',
    configurable: false, wizardSteps: 0,
  },
  members: {
    type: 'members', label: 'Membros', icon: 'Users2',
    description: 'Gerenciar membros e permissões do projeto.',
    configurable: false, wizardSteps: 0,
  },
  docs: {
    type: 'docs', label: 'Documentos', icon: 'Paperclip',
    description: 'Anexos e arquivos do projeto.',
    configurable: false, wizardSteps: 0,
  },
  dashboard: {
    type: 'dashboard', label: 'Dashboard', icon: 'BarChart3',
    description: 'Dashboard analítico configurável com cards de dados.',
    configurable: true, wizardSteps: 0,
  },
}
