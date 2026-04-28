import { useQuery } from '@tanstack/react-query'

import { opportunitiesApi } from '../api'
import type { ListOpportunitiesFilters } from '../types'

/** Lista de oportunidades do tenant (filtros opcionais via querystring). */
export function useOpportunities(filters: ListOpportunitiesFilters = {}) {
  return useQuery({
    queryKey: ['opportunities', 'list', filters],
    queryFn: () => opportunitiesApi.list(filters),
  })
}
