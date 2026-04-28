import { useQuery } from '@tanstack/react-query'
import { forecastsApi } from '../api'

export function useForecastsByProject(projectId: string | undefined | null) {
  return useQuery({
    queryKey: ['forecasts', 'byProject', projectId],
    queryFn: () => forecastsApi.listByProject(projectId as string),
    enabled: Boolean(projectId),
  })
}
