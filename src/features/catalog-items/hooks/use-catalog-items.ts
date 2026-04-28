import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogItemsApi } from '../api'
import type { CreateCatalogItemInput, UpdateCatalogItemInput } from '../types'

export function useCatalogItems(tenantId?: string) {
  return useQuery({
    queryKey: ['catalog-items', 'list', tenantId ?? null],
    queryFn: () => catalogItemsApi.list(tenantId),
  })
}
export function useCreateCatalogItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCatalogItemInput) => catalogItemsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-items', 'list'] }),
  })
}
export function useUpdateCatalogItem(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCatalogItemInput) => catalogItemsApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-items', 'list'] }),
  })
}
export function useDeleteCatalogItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => catalogItemsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-items', 'list'] }),
  })
}
