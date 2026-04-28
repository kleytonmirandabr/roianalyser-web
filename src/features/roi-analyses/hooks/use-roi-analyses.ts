import { useQuery } from '@tanstack/react-query'
import { roiAnalysesApi } from '../api'

export function useRoiAnalysesByOpportunity(opportunityId: string | undefined | null) {
  return useQuery({
    queryKey: ['roi-analyses', 'byOpp', opportunityId],
    queryFn: () => roiAnalysesApi.listByOpportunity(opportunityId as string),
    enabled: Boolean(opportunityId),
  })
}

/** Todas as análises de ROI do tenant. Usado no dashboard. */
export function useAllRoiAnalyses() {
  return useQuery({
    queryKey: ['roi-analyses', 'list'],
    queryFn: () => roiAnalysesApi.list(),
  })
}
