import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projects2Api } from '../api'

export function useDeleteProject2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projects2Api.delete(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['projects2', 'list'] })
      qc.invalidateQueries({ queryKey: ['projects2', 'detail', id] })
    },
  })
}
