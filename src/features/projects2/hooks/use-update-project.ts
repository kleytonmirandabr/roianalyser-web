import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projects2Api } from '../api'
import type { Project, UpdateProjectInput } from '../types'

export function useUpdateProject2(id: string | undefined | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: UpdateProjectInput) => projects2Api.update(id as string, i),
    onSuccess: (item: Project) => {
      qc.setQueryData(['projects2', 'detail', id], item)
      qc.invalidateQueries({ queryKey: ['projects2', 'list'] })
    },
  })
}
