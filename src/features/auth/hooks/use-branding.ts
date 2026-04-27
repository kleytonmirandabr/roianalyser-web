import { useQuery } from '@tanstack/react-query'

import { authApi } from '../api'

/** Logo e nome do sistema exibidos na tela de login. */
export function useBranding() {
  return useQuery({
    queryKey: ['auth', 'branding'],
    queryFn: () => authApi.branding(),
    staleTime: 5 * 60_000,
  })
}
