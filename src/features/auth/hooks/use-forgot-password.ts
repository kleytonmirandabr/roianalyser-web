import { useMutation } from '@tanstack/react-query'

import { authApi } from '../api'

export function useForgotPassword() {
  return useMutation({
    mutationFn: (login: string) => authApi.forgotPassword({ login }),
  })
}
