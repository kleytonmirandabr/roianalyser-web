import { api } from '@/shared/api/client'

import type {
  CreateScheduledReportInput,
  ScheduledReport,
  UpdateScheduledReportInput,
} from './scheduled-types'

export const scheduledReportsApi = {
  list: () =>
    api
      .get<{ items: ScheduledReport[] }>('/scheduled-reports')
      .then((response) => response.items ?? []),

  create: (input: CreateScheduledReportInput) =>
    api
      .post<{ item: ScheduledReport }>('/scheduled-reports', input)
      .then((response) => response.item),

  update: (id: string, input: UpdateScheduledReportInput) =>
    api
      .patch<{ item: ScheduledReport }>(
        `/scheduled-reports/${encodeURIComponent(id)}`,
        input,
      )
      .then((response) => response.item),

  delete: (id: string) =>
    api.delete<void>(`/scheduled-reports/${encodeURIComponent(id)}`),

  sendNow: (id: string) =>
    api.post<{ ok: boolean; item: ScheduledReport }>(
      `/scheduled-reports/${encodeURIComponent(id)}/send-now`,
    ),
}
