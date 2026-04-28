import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sectorsApi } from '../api'
import type { CreateSectorInput, UpdateSectorInput } from '../types'

export function useSectors(tenantId?: string) {
  return useQuery({
    queryKey: ['sectors', 'list', tenantId ?? null],
    queryFn: () => sectorsApi.list(tenantId),
  })
}
export function useCreateSector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSectorInput) => sectorsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sectors', 'list'] }),
  })
}
export function useUpdateSector(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSectorInput) => sectorsApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sectors', 'list'] }),
  })
}
export function useDeleteSector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sectorsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sectors', 'list'] }),
  })
}
