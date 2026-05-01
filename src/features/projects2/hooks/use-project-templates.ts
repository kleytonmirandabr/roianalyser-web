import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectTemplatesApi } from '../templates-api'
import type { CreateTemplateInput, UpdateTemplateInput } from '../templates-types'

const KEY = ['project-templates']

export function useProjectTemplates() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => projectTemplatesApi.list(),
    staleTime: 10_000,
  })
}

export function useProjectTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['project-templates', 'detail', id],
    queryFn: () => projectTemplatesApi.getById(id as string),
    enabled: !!id,
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => projectTemplatesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTemplateInput }) =>
      projectTemplatesApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectTemplatesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
