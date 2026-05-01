import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectTaskColumnsApi } from '../task-columns-api'
import type { CreateColumnInput, UpdateColumnInput } from '../task-columns-types'

const COLS_KEY = (pid: string) => ['project-task-columns', pid]
const VALS_KEY = (pid: string) => ['project-task-column-values', pid]

export function useProjectTaskColumns(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? COLS_KEY(projectId) : ['project-task-columns', 'none'],
    queryFn: () => projectTaskColumnsApi.list(projectId as string),
    enabled: !!projectId,
  })
}

export function useCreateColumn(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateColumnInput) => projectTaskColumnsApi.create(projectId as string, input),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: COLS_KEY(projectId) }),
  })
}

export function useUpdateColumn(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateColumnInput }) =>
      projectTaskColumnsApi.update(projectId as string, id, patch),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: COLS_KEY(projectId) }),
  })
}

export function useDeleteColumn(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectTaskColumnsApi.remove(projectId as string, id),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: COLS_KEY(projectId) }),
  })
}

export function useColumnValues(projectId: string | undefined, taskIds: string[]) {
  return useQuery({
    queryKey: projectId ? [...VALS_KEY(projectId), taskIds.slice().sort().join(',')] : ['vals', 'none'],
    queryFn: () => projectTaskColumnsApi.listValues(projectId as string, taskIds),
    enabled: !!projectId && taskIds.length > 0,
  })
}

export function usePutColumnValue(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, columnId, value }: { taskId: string; columnId: string; value: any }) =>
      projectTaskColumnsApi.putValue(projectId as string, taskId, columnId, value),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: VALS_KEY(projectId) }),
  })
}
