import { useQuery } from '@tanstack/react-query'
import { projects2Api } from '../api'
import type { ListProjectsFilters } from '../types'

export function useProjects2(filters: ListProjectsFilters = {}) {
  return useQuery({
    queryKey: ['projects2', 'list', filters],
    queryFn: () => projects2Api.list(filters),
  })
}
