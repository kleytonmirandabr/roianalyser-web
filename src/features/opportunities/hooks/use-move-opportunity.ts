/**
 * Move opportunity para outro status (drag-drop no Kanban).
 * Recebe NOME do status (vindo da coluna do board) e resolve o statusId via cache.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { opportunitiesApi } from '../api'
import { opportunityStatusesApi } from '@/features/opportunity-statuses/api'

type MoveInput = {
  id: string
  statusName: string | null
}

export function useMoveOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, statusName }: MoveInput) => {
      // Fetch statuses cache to resolve name -> id
      const cached = qc.getQueryData<any[]>(['opportunity-statuses', 'list'])
      const list = cached ?? (await opportunityStatusesApi.list())
      const status = statusName ? list.find((s: any) => s.name === statusName) : null
      const statusId = status ? String(status.id) : null
      return opportunitiesApi.update(id, { statusId })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['opportunities', 'list'] })
    },
  })
}
