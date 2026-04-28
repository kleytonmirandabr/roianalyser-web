import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { itemCategoriesApi } from '../api'
import type { CreateItemCategoryInput, UpdateItemCategoryInput } from '../types'

export function useItemCategories(tenantId?: string) {
  return useQuery({
    queryKey: ['item-categories', 'list', tenantId ?? null],
    queryFn: () => itemCategoriesApi.list(tenantId),
  })
}
export function useCreateItemCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateItemCategoryInput) => itemCategoriesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['item-categories', 'list'] }),
  })
}
export function useUpdateItemCategory(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateItemCategoryInput) => itemCategoriesApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['item-categories', 'list'] }),
  })
}
export function useDeleteItemCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => itemCategoriesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['item-categories', 'list'] }),
  })
}
