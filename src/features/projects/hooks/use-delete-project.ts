import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectsApi } from '../api'

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
    },
  })
}
