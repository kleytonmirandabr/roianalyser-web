import { useMutation, useQueryClient } from '@tanstack/react-query'
import { forecastsApi } from '../api'
import type { Forecast, UpdateForecastInput } from '../types'

export function useUpdateForecast(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: UpdateForecastInput) => forecastsApi.update(id as string, i),
    onSuccess: (item: Forecast) => {
      qc.invalidateQueries({ queryKey: ['forecasts', 'detail', id] })
      qc.invalidateQueries({ queryKey: ['forecasts', 'byProject', item.projectId] })
    },
  })
}
