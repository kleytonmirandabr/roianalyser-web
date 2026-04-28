/**
 * Tipos de Projeto NOVO (Sprint 4 — schema do Phase 0).
 * Path features/projects2/ pra evitar conflito com features/projects (legacy).
 */

export type ProjectStatus =
  | 'planning' | 'execution' | 'paused' | 'done' | 'cancelled'

export const PROJECT_STATUSES: ProjectStatus[] = [
  'planning', 'execution', 'paused', 'done', 'cancelled',
]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planejamento',
  execution: 'Em execução',
  paused: 'Pausado',
  done: 'Concluído',
  cancelled: 'Cancelado',
}

export type Project = {
  id: string
  tenantId: string
  contractId: string | null
  clientId: string
  managerId: string
  projectCode: string
  name: string
  status: ProjectStatus
  plannedStart: string | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  progressPct: number
  budget: number | null
  currency: string
  description: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deletedBy: string | null
}

export type CreateProjectInput = {
  name: string
  status?: ProjectStatus
  contractId?: string | null
  clientId?: string
  managerId?: string
  projectCode?: string  // auto-gerado se omitido
  plannedStart?: string | null
  plannedEnd?: string | null
  progressPct?: number
  budget?: number | null
  currency?: string
  description?: string | null
  tenantId?: string
}

export type UpdateProjectInput = Partial<
  Pick<Project,
    | 'name' | 'status' | 'clientId' | 'managerId'
    | 'plannedStart' | 'plannedEnd' | 'actualStart' | 'actualEnd'
    | 'progressPct' | 'budget' | 'currency' | 'description'
  >
>

export type ListProjectsFilters = {
  status?: ProjectStatus | ProjectStatus[]
  managerId?: string
  clientId?: string
  contractId?: string
  tenantId?: string
}
