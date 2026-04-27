import { useQuery } from '@tanstack/react-query'

import { projectsApi } from '../api'

/** Busca um projeto pelo id. */
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  })
}
