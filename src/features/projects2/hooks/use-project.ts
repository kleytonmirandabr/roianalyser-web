import { useQuery } from '@tanstack/react-query'
import { projects2Api } from '../api'

export function useProject2(id: string | undefined | null) {
  return useQuery({
    queryKey: ['projects2', 'detail', id],
    queryFn: () => projects2Api.getById(id as string),
    enabled: Boolean(id),
  })
}
