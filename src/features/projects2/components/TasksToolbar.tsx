/**
 * Toolbar do card de Tarefas (Phase 3 Sprint 3.3 - Monday-style polish).
 *
 * Pesquisar, filtrar por pessoa/status, ordenar.
 */
import { Search, X } from 'lucide-react'

import {
  MILESTONE_STATUS_LABELS, type MilestoneStatus,
} from '@/features/projects2/milestones-types'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'

export type SortKey = 'order' | 'title' | 'plannedDate' | 'status' | 'progress'

interface UserMini { id: string; name: string }

export interface TasksFilters {
  q: string
  status: MilestoneStatus | ''
  personId: string
  sort: SortKey
}

interface Props {
  filters: TasksFilters
  onChange: (next: Partial<TasksFilters>) => void
  users: UserMini[]
}

export function TasksToolbar({ filters, onChange, users }: Props) {
  const statusOptions = [
    { value: '', label: 'Todos os status' },
    ...(Object.entries(MILESTONE_STATUS_LABELS) as Array<[MilestoneStatus, string]>)
      .map(([value, label]) => ({ value, label })),
  ]

  const personOptions = [
    { value: '', label: 'Todos' },
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  const sortOptions: Array<{ value: SortKey; label: string }> = [
    { value: 'order', label: 'Ordem manual' },
    { value: 'title', label: 'Titulo (A-Z)' },
    { value: 'plannedDate', label: 'Prazo' },
    { value: 'status', label: 'Status' },
    { value: 'progress', label: 'Progresso' },
  ]

  const hasActiveFilter = filters.q || filters.status || filters.personId || filters.sort !== 'order'

  return (
    <div className="px-6 pb-3 flex items-center gap-2 flex-wrap border-b">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Pesquisar tarefa..."
          className="h-8 pl-7 text-xs"
        />
      </div>
      <div className="w-36">
        <Combobox
          options={personOptions}
          value={filters.personId}
          onChange={(v) => onChange({ personId: v })}
          placeholder="Pessoa"
        />
      </div>
      <div className="w-44">
        <Combobox
          options={statusOptions}
          value={filters.status || ''}
          onChange={(v) => onChange({ status: v as any })}
          placeholder="Status"
        />
      </div>
      <div className="w-44">
        <Combobox
          options={sortOptions.map(o => ({ value: o.value, label: o.label }))}
          value={filters.sort}
          onChange={(v) => onChange({ sort: v as SortKey })}
          placeholder="Ordenar"
        />
      </div>
      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => onChange({ q: '', status: '', personId: '', sort: 'order' })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          title="Limpar filtros"
        >
          <X className="h-3.5 w-3.5" /> Limpar
        </button>
      )}
    </div>
  )
}
