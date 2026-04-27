import { useMutation } from '@tanstack/react-query'

import { authApi, type ResetPasswordInput } from '../api'

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input),
  })
}
