import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projects2Api } from '../api'
import type { CreateProjectInput } from '../types'

export function useCreateProject2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: CreateProjectInput) => projects2Api.create(i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects2', 'list'] }),
  })
}
