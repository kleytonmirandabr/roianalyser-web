import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { financialTypesApi } from '../api'
import type { CreateFinancialTypeInput, UpdateFinancialTypeInput } from '../types'

export function useFinancialTypes(tenantId?: string) {
  return useQuery({
    queryKey: ['financial-types', 'list', tenantId ?? null],
    queryFn: () => financialTypesApi.list(tenantId),
  })
}
export function useCreateFinancialType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFinancialTypeInput) => financialTypesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-types', 'list'] }),
  })
}
export function useUpdateFinancialType(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateFinancialTypeInput) => financialTypesApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-types', 'list'] }),
  })
}
export function useDeleteFinancialType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => financialTypesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-types', 'list'] }),
  })
}
