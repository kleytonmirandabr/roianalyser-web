import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/hooks/use-auth'

import { catalogsApi } from '../api'
import type { CatalogItem, CatalogType } from '../types'

function catalogQueryKey(clientId: string | undefined, type: CatalogType) {
  return ['catalogs', clientId, type] as const
}

export function useCatalog(type: CatalogType) {
  const { user } = useAuth()
  const clientId = user?.clientId

  return useQuery({
    queryKey: catalogQueryKey(clientId, type),
    queryFn: () => catalogsApi.list(clientId!, type),
    enabled: !!clientId,
  })
}

export function useCreateCatalogItem(type: CatalogType) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const clientId = user?.clientId

  return useMutation({
    mutationFn: (input: Partial<CatalogItem>) => {
      if (!clientId) throw new Error('Sem clientId na sessão')
      return catalogsApi.create(clientId, type, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: catalogQueryKey(clientId, type),
      })
    },
  })
}

export function useUpdateCatalogItem(type: CatalogType) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const clientId = user?.clientId

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CatalogItem> }) => {
      if (!clientId) throw new Error('Sem clientId na sessão')
      return catalogsApi.update(clientId, type, id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: catalogQueryKey(clientId, type),
      })
    },
  })
}

export function useDeleteCatalogItem(type: CatalogType) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const clientId = user?.clientId

  return useMutation({
    mutationFn: (id: string) => {
      if (!clientId) throw new Error('Sem clientId na sessão')
      return catalogsApi.delete(clientId, type, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: catalogQueryKey(clientId, type),
      })
    },
  })
}
