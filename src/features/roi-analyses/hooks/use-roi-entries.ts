import { useMutation, useQueryClient } from '@tanstack/react-query'
import { roiAnalysesApi } from '../api'
import type { CreateRoiEntryInput, UpdateRoiEntryInput } from '../types'

export function useAddRoiEntry(roiId: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: CreateRoiEntryInput) => roiAnalysesApi.addEntry(roiId as string, i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roi-analyses', 'detail', roiId] }),
  })
}

export function useUpdateRoiEntry(roiId: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, patch }: { entryId: string; patch: UpdateRoiEntryInput }) =>
      roiAnalysesApi.updateEntry(entryId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roi-analyses', 'detail', roiId] }),
  })
}

export function useDeleteRoiEntry(roiId: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => roiAnalysesApi.deleteEntry(entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roi-analyses', 'detail', roiId] }),
  })
}
