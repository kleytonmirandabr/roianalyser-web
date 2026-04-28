import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { formFieldsApi } from '../api'
import type {
  CreateFormFieldInput,
  FormField,
  FormFieldEntityType,
  FormFieldScope,
  SetFormFieldValueInput,
  UpdateFormFieldInput,
} from '../types'

/** Lista as definições de form_fields do tenant + scope. */
export function useFormFields(scope?: FormFieldScope, tenantId?: string) {
  return useQuery({
    queryKey: ['form-fields', 'list', scope ?? null, tenantId ?? null],
    queryFn: () => formFieldsApi.list(scope, tenantId),
  })
}

export function useCreateFormField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFormFieldInput) => formFieldsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-fields', 'list'] })
    },
  })
}

export function useUpdateFormField(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateFormFieldInput) =>
      formFieldsApi.update(id as string, input),
    onSuccess: (_item: FormField) => {
      qc.invalidateQueries({ queryKey: ['form-fields', 'list'] })
    },
  })
}

export function useDeleteFormField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formFieldsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-fields', 'list'] })
    },
  })
}

/** Carrega valores das custom fields de uma entity específica. */
export function useFormFieldValues(
  entityType: FormFieldEntityType | null | undefined,
  entityId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['form-field-values', entityType, entityId],
    enabled: Boolean(entityType && entityId),
    queryFn: () =>
      formFieldsApi.getValues(entityType as FormFieldEntityType, entityId as string),
  })
}

/** Atualiza (upsert batch) os valores de custom fields de uma entity. */
export function usePutFormFieldValues(
  entityType: FormFieldEntityType | null | undefined,
  entityId: string | null | undefined,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: SetFormFieldValueInput[]) =>
      formFieldsApi.putValues(
        entityType as FormFieldEntityType,
        entityId as string,
        values,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-field-values', entityType, entityId] })
    },
  })
}
