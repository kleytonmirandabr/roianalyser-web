import { api } from '@/shared/api/client'

import type {
  CreateOpportunityDeletionReasonInput,
  OpportunityDeletionReason,
  UpdateOpportunityDeletionReasonInput,
} from './types'

export const opportunityDeletionReasonsApi = {
  list: () =>
    api
      .get<{ items: OpportunityDeletionReason[] }>('/opportunity-deletion-reasons')
      .then((response) => response.items),

  create: (input: CreateOpportunityDeletionReasonInput) =>
    api
      .post<{ item: OpportunityDeletionReason }>('/opportunity-deletion-reasons', input)
      .then((response) => response.item),

  update: (id: string, input: UpdateOpportunityDeletionReasonInput) =>
    api
      .patch<{ item: OpportunityDeletionReason }>(
        `/opportunity-deletion-reasons/${encodeURIComponent(id)}`,
        input,
      )
      .then((response) => response.item),

  delete: (id: string) =>
    api.delete<void>(`/opportunity-deletion-reasons/${encodeURIComponent(id)}`),
}
