import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingUnitsApi } from '../api'
import type { CreateBillingUnitInput, UpdateBillingUnitInput } from '../types'

export function useBillingUnits(tenantId?: string) {
  return useQuery({
    queryKey: ['billing-units', 'list', tenantId ?? null],
    queryFn: () => billingUnitsApi.list(tenantId),
  })
}
export function useCreateBillingUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBillingUnitInput) => billingUnitsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-units', 'list'] }),
  })
}
export function useUpdateBillingUnit(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateBillingUnitInput) => billingUnitsApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-units', 'list'] }),
  })
}
export function useDeleteBillingUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => billingUnitsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-units', 'list'] }),
  })
}
