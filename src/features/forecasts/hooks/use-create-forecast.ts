import { useMutation, useQueryClient } from '@tanstack/react-query'
import { forecastsApi } from '../api'
import type { CreateForecastInput } from '../types'

export function useCreateForecast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: CreateForecastInput) => forecastsApi.create(i),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ['forecasts', 'byProject', item.projectId] })
    },
  })
}
