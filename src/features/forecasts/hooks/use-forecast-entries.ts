import { useMutation, useQueryClient } from '@tanstack/react-query'
import { forecastsApi } from '../api'
import type { CreateForecastEntryInput, UpdateForecastEntryInput } from '../types'

export function useAddForecastEntry(forecastId: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: CreateForecastEntryInput) => forecastsApi.addEntry(forecastId as string, i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forecasts', 'detail', forecastId] }),
  })
}

export function useUpdateForecastEntry(forecastId: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, patch }: { entryId: string; patch: UpdateForecastEntryInput }) =>
      forecastsApi.updateEntry(entryId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forecasts', 'detail', forecastId] }),
  })
}

export function useDeleteForecastEntry(forecastId: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => forecastsApi.deleteEntry(entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forecasts', 'detail', forecastId] }),
  })
}
