import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../api'
import type { CreateTaskInput, TaskListFilters, UpdateTaskInput } from '../types'

const KEY = (filters?: TaskListFilters) => ['tasks', 'list', filters ?? null]

export function useTasks(filters?: TaskListFilters) {
  return useQuery({
    queryKey: KEY(filters),
    queryFn: () => tasksApi.list(filters),
    staleTime: 15_000,
  })
}

export function useTask(id: string | undefined | null) {
  return useQuery({
    queryKey: ['tasks', 'one', id ?? null],
    queryFn: () => tasksApi.get(id as string),
    enabled: !!id,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
    },
  })
}

export function useUpdateTask(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => tasksApi.update(id as string, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
      qc.invalidateQueries({ queryKey: ['tasks', 'one', id] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
    },
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
    },
  })
}

export function useBulkCompleteTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => tasksApi.bulkComplete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
    },
  })
}
