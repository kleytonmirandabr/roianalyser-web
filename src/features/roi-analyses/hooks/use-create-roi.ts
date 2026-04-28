import { useMutation, useQueryClient } from '@tanstack/react-query'
import { roiAnalysesApi } from '../api'
import type { CreateRoiInput } from '../types'

export function useCreateRoiAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: CreateRoiInput) => roiAnalysesApi.create(i),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ['roi-analyses', 'byOpp', item.opportunityId] })
    },
  })
}
