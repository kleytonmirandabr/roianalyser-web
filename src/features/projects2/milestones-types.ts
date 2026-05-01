export type MilestoneStatus = 'pending' | 'completed' | 'cancelled'

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pendente',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

export type ProjectMilestone = {
  id: string
  tenantId: string
  projectId: string
  title: string
  description: string | null
  plannedDate: string | null
  completedDate: string | null
  status: MilestoneStatus
  displayOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateMilestoneInput = {
  title: string
  description?: string | null
  plannedDate?: string | null
  status?: MilestoneStatus
  displayOrder?: number
}

export type UpdateMilestoneInput = Partial<CreateMilestoneInput> & {
  completedDate?: string | null
}
