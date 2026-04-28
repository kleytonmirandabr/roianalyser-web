import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { salesGoalsApi } from '../api'
import type { CreateSalesGoalInput, UpdateSalesGoalInput } from '../types'

export function useSalesGoals(tenantId?: string) {
  return useQuery({
    queryKey: ['sales-goals', 'list', tenantId ?? null],
    queryFn: () => salesGoalsApi.list(tenantId),
  })
}
export function useCreateSalesGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSalesGoalInput) => salesGoalsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-goals', 'list'] }),
  })
}
export function useUpdateSalesGoal(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSalesGoalInput) => salesGoalsApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-goals', 'list'] }),
  })
}
export function useDeleteSalesGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => salesGoalsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-goals', 'list'] }),
  })
}
