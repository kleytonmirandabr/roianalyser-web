import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectsApi } from '../api'
import type { CreateProjectInput } from '../types'

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
    },
  })
}
