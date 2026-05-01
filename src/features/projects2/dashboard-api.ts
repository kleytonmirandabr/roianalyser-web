import { api } from '@/shared/api/client'
import type { DashboardData } from './dashboard-types'

export const projectDashboardApi = {
  get: () => api.get<DashboardData>('/projects2/dashboard'),
}
