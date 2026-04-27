import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectsApi } from '../api'
import type { UpdateProjectInput } from '../types'

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectsApi.update(id, input),
    onSuccess: (project) => {
      queryClient.setQueryData(['projects', 'detail', id], project)
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
    },
  })
}
