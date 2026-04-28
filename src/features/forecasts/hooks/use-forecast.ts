import { useQuery } from '@tanstack/react-query'
import { forecastsApi } from '../api'

export function useForecast(id: string | undefined | null) {
  return useQuery({
    queryKey: ['forecasts', 'detail', id],
    queryFn: () => forecastsApi.getById(id as string),
    enabled: Boolean(id),
  })
}
