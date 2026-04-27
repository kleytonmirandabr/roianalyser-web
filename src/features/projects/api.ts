import { api } from '@/shared/api/client'

import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from './types'

/**
 * O backend usa `/api/contracts` mas para o usuário final são "projetos".
 * Mantemos o nome do domínio (Project) na UI e mapeamos aqui.
 */
export const projectsApi = {
  list: () =>
    api
      .get<{ items: Project[] }>('/contracts')
      .then((response) => response.items),

  getById: (id: string) =>
    api
      .get<{ item: Project }>(`/contracts/${encodeURIComponent(id)}`)
      .then((response) => response.item),

  create: (input: CreateProjectInput) =>
    api
      .post<{ item: Project }>('/contracts', input)
      .then((response) => response.item),

  update: (id: string, input: UpdateProjectInput) =>
    api
      .put<{ item: Project }>(`/contracts/${encodeURIComponent(id)}`, input)
      .then((response) => response.item),

  delete: (id: string) =>
    api.delete<void>(`/contracts/${encodeURIComponent(id)}`),
}
