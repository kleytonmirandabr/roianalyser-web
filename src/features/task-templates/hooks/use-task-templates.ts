import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { taskTemplatesApi } from '../api'
import type { CreateTaskTemplateInput, UpdateTaskTemplateInput } from '../types'

export function useTaskTemplates(tenantId?: string) {
  return useQuery({
    queryKey: ['task-templates', 'list', tenantId ?? null],
    queryFn: () => taskTemplatesApi.list(tenantId),
  })
}
export function useCreateTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskTemplateInput) => taskTemplatesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-templates', 'list'] }),
  })
}
export function useUpdateTaskTemplate(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTaskTemplateInput) =>
      taskTemplatesApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-templates', 'list'] }),
  })
}
export function useDeleteTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => taskTemplatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-templates', 'list'] }),
  })
}
