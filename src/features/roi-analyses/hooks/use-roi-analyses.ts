import { useQuery } from '@tanstack/react-query'
import { roiAnalysesApi } from '../api'

export function useRoiAnalysesByOpportunity(opportunityId: string | undefined | null) {
  return useQuery({
    queryKey: ['roi-analyses', 'byOpp', opportunityId],
    queryFn: () => roiAnalysesApi.listByOpportunity(opportunityId as string),
    enabled: Boolean(opportunityId),
  })
}
