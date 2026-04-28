import { useMutation, useQueryClient } from '@tanstack/react-query'
import { roiAnalysesApi } from '../api'
import type { RoiAnalysis, UpdateRoiInput } from '../types'

export function useUpdateRoiAnalysis(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: UpdateRoiInput) => roiAnalysesApi.update(id as string, i),
    onSuccess: (item: RoiAnalysis) => {
      qc.invalidateQueries({ queryKey: ['roi-analyses', 'detail', id] })
      qc.invalidateQueries({ queryKey: ['roi-analyses', 'byOpp', item.opportunityId] })
    },
  })
}
