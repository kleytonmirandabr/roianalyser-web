import { useQuery } from '@tanstack/react-query'
import { projectDashboardApi } from '../dashboard-api'

export function useProjectDashboard() {
  return useQuery({
    queryKey: ['project-dashboard'],
    queryFn: () => projectDashboardApi.get(),
    staleTime: 30_000,
  })
}
