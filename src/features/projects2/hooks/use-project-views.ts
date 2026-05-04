import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { viewsApi } from '../views-api'
import type { ViewConfig, ViewType } from '../view-types'

const KEY = (projectId: string) => ['project-views', projectId]

export function useProjectViews(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? KEY(projectId) : ['project-views', 'none'],
    queryFn: () => viewsApi.list(projectId as string),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useCreateView(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: ViewType; name: string; config?: ViewConfig }) =>
      viewsApi.create(projectId as string, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(projectId as string) }),
  })
}

export function useUpdateView(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ viewId, ...data }: { viewId: string } & Partial<{ name: string; config: ViewConfig; position: number; enabled: boolean }>) =>
      viewsApi.update(projectId as string, viewId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(projectId as string) }),
  })
}

export function useDeleteView(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (viewId: string) => viewsApi.remove(projectId as string, viewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(projectId as string) }),
  })
}
