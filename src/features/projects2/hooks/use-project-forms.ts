import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectFormsApi } from '../form-api'
import type { CreateFormInput, UpdateFormInput } from '../form-types'

const FORMS_KEY = (pid: string) => ['project-forms', pid]

export function useProjectForms(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? FORMS_KEY(projectId) : ['project-forms', 'none'],
    queryFn: () => projectFormsApi.list(projectId as string),
    enabled: !!projectId,
  })
}

export function useCreateProjectForm(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFormInput) =>
      projectFormsApi.create(projectId as string, input),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: FORMS_KEY(projectId) }),
  })
}

export function useUpdateProjectForm(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateFormInput }) =>
      projectFormsApi.update(projectId as string, id, patch),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: FORMS_KEY(projectId) }),
  })
}

export function useDeleteProjectForm(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectFormsApi.remove(projectId as string, id),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: FORMS_KEY(projectId) }),
  })
}

export function useFormSubmissions(projectId: string | undefined, formId: string | undefined) {
  return useQuery({
    queryKey: ['form-submissions', projectId, formId],
    queryFn: () => projectFormsApi.submissions(projectId as string, formId as string),
    enabled: !!projectId && !!formId,
  })
}
