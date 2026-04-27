import { api } from '@/shared/api/client'

import type { Report, ReportRunResult } from './types'

export const reportsApi = {
  list: () =>
    api
      .get<{ items: Report[] }>('/reports')
      .then((response) => response.items ?? []),

  getById: (id: string) =>
    api
      .get<{ item: Report }>(`/reports/${encodeURIComponent(id)}`)
      .then((response) => response.item),

  create: (input: Partial<Report>) =>
    api
      .post<{ item: Report }>('/reports', input)
      .then((response) => response.item),

  update: (id: string, input: Partial<Report>) =>
    api
      .put<{ item: Report }>(`/reports/${encodeURIComponent(id)}`, input)
      .then((response) => response.item),

  delete: (id: string) =>
    api.delete<void>(`/reports/${encodeURIComponent(id)}`),

  /** Executa o relatório e devolve o resultado calculado pelo backend. */
  run: (id: string) =>
    api.post<ReportRunResult>(`/reports/${encodeURIComponent(id)}/run`),
}
