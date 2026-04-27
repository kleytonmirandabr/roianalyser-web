import { useQuery } from '@tanstack/react-query'

import { projectsApi } from '../api'

/** Lista de projetos do tenant atual. */
export function useProjects() {
  return useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => projectsApi.list(),
  })
}
