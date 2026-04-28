import { api } from '@/shared/api/client'

import type {
  CreateFormFieldInput,
  FormField,
  FormFieldEntityType,
  FormFieldScope,
  FormFieldValue,
  SetFormFieldValueInput,
  UpdateFormFieldInput,
} from './types'

export const formFieldsApi = {
  list: (scope?: FormFieldScope, tenantId?: string) => {
    const params = new URLSearchParams()
    if (scope) params.set('scope', scope)
    if (tenantId) params.set('tenantId', tenantId)
    const qs = params.toString()
    return api
      .get<{ items: FormField[] }>(`/form-fields${qs ? `?${qs}` : ''}`)
      .then((r) => r.items)
  },

  create: (input: CreateFormFieldInput) =>
    api
      .post<{ item: FormField }>('/form-fields', input)
      .then((r) => r.item),

  update: (id: string, input: UpdateFormFieldInput) =>
    api
      .patch<{ item: FormField }>(`/form-fields/${encodeURIComponent(id)}`, input)
      .then((r) => r.item),

  delete: (id: string) =>
    api.delete<void>(`/form-fields/${encodeURIComponent(id)}`),

  getValues: (entityType: FormFieldEntityType, entityId: string) =>
    api
      .get<{ items: FormFieldValue[] }>(
        `/form-field-values/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
      )
      .then((r) => r.items),

  putValues: (
    entityType: FormFieldEntityType,
    entityId: string,
    values: SetFormFieldValueInput[],
  ) =>
    api
      .put<{ items: FormFieldValue[] }>(
        `/form-field-values/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
        { values },
      )
      .then((r) => r.items),
}
