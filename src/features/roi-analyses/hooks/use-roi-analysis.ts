import { useQuery } from '@tanstack/react-query'
import { roiAnalysesApi } from '../api'

export function useRoiAnalysis(id: string | undefined | null) {
  return useQuery({
    queryKey: ['roi-analyses', 'detail', id],
    queryFn: () => roiAnalysesApi.getById(id as string),
    enabled: Boolean(id),
  })
}
