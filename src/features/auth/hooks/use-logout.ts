import { useMutation } from '@tanstack/react-query'

import { useAuth } from './use-auth'

export function useLogout() {
  const { signOut } = useAuth()
  return useMutation({ mutationFn: signOut })
}
