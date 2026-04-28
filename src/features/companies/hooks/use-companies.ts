import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api'
import type { CreateCompanyInput, UpdateCompanyInput } from '../types'

export function useCompanies(tenantId?: string) {
  return useQuery({
    queryKey: ['companies', 'list', tenantId ?? null],
    queryFn: () => companiesApi.list(tenantId),
  })
}
export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCompanyInput) => companiesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies', 'list'] }),
  })
}
export function useUpdateCompany(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCompanyInput) => companiesApi.update(id as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies', 'list'] }),
  })
}
export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies', 'list'] }),
  })
}
