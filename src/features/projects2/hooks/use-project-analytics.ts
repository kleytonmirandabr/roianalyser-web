import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { analyticsApi } from '../analytics-api'
import type { AnalyticsQuery, ReportConfig } from '../analytics-types'

export function useAnalyticsDatasets(projectId: string | number) {
  return useQuery({
    queryKey: ['analytics-datasets', projectId],
    queryFn: () => analyticsApi.getDatasets(projectId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAnalyticsQuery(
  projectId: string | number,
  query: AnalyticsQuery | null,
  enabled = true
) {
  return useQuery({
    queryKey: ['analytics-query', projectId, query],
    queryFn: () => analyticsApi.query(projectId, query!),
    enabled: enabled && !!query && !!query.dataset,
    staleTime: 60_000,
  })
}

export function useAnalyticsReports(projectId: string | number) {
  return useQuery({
    queryKey: ['analytics-reports', projectId],
    queryFn: () => analyticsApi.listReports(projectId),
  })
}

export function useCreateReport(projectId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, dataset, config }: { name: string; dataset: string; config: ReportConfig }) =>
      analyticsApi.createReport(projectId, name, dataset, config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics-reports', projectId] }),
  })
}

export function useUpdateReport(projectId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, dataset, config }: { id: number; name: string; dataset: string; config: ReportConfig }) =>
      analyticsApi.updateReport(projectId, id, name, dataset, config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics-reports', projectId] }),
  })
}

export function useDeleteReport(projectId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => analyticsApi.deleteReport(projectId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics-reports', projectId] }),
  })
}
