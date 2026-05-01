import type { ProjectStatus } from './types'
import type { MilestoneStatus } from './milestones-types'

export interface DashboardProject {
  id: string
  projectCode: string
  name: string
  status: ProjectStatus
  plannedStart: string | null
  plannedEnd: string | null
  progressPct: number
  budget: number | null
  currency: string
  clientId: string
}

export interface DashboardTask {
  taskId: string
  projectId: string
  projectCode: string
  projectName: string
  title: string
  plannedDate: string
  status: MilestoneStatus
}

export interface DashboardOverdueTask extends DashboardTask {
  daysLate: number
}

export interface DashboardUpcomingTask extends DashboardTask {
  dueIn: number
}

export interface DashboardKpis {
  total: number
  byStatus: Record<ProjectStatus, number>
  overdueCount: number
  completedCount: number
  budgetTotal: number
  executedTotal: number
  overdueTasksCount: number
  upcomingTasksCount: number
}

export interface DashboardData {
  projects: DashboardProject[]
  kpis: DashboardKpis
  overdueTasks: DashboardOverdueTask[]
  upcomingTasks: DashboardUpcomingTask[]
}
