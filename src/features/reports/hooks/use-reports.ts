import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { reportsApi } from '../api'

export function useReports() {
  return useQuery({
    queryKey: ['reports', 'list'],
    queryFn: () => reportsApi.list(),
  })
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'detail', id],
    queryFn: () => reportsApi.getById(id!),
    enabled: !!id,
  })
}

export function useDeleteReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'list'] })
    },
  })
}

export function useRunReport() {
  return useMutation({
    mutationFn: (id: string) => reportsApi.run(id),
  })
}
