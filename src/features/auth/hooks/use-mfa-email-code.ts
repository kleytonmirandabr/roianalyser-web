import { useMutation } from '@tanstack/react-query'

import { authApi } from '../api'

/**
 * Solicita ao backend o envio do código MFA por e-mail (alternativa ao TOTP).
 * Recebe o mfaToken obtido do /api/auth/login.
 */
export function useMfaEmailCode() {
  return useMutation({
    mutationFn: (mfaToken: string) => authApi.mfaEmailCode(mfaToken),
  })
}
