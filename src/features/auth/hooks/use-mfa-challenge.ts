import { useMutation } from '@tanstack/react-query'

import { authApi, type MfaChallengeInput } from '../api'
import type { SessionPayload } from '../types'
import { useAuth } from './use-auth'

export type MfaChallengeVariables = MfaChallengeInput & {
  mfaToken: string
  /** Persistência do "Lembrar-me" escolhido na tela de login. */
  remember: boolean
}

/**
 * Resolve o desafio de MFA. O backend consome o mfaToken e devolve
 * o SessionPayload real, que aqui persistimos no AuthProvider.
 */
export function useMfaChallenge() {
  const { setSession } = useAuth()

  return useMutation<SessionPayload, Error, MfaChallengeVariables>({
    mutationFn: ({ code, recoveryCode, rememberDevice, mfaToken }) =>
      authApi.mfaChallenge({ code, recoveryCode, rememberDevice }, mfaToken),
    onSuccess: (payload, variables) => {
      setSession(payload, variables.remember)
    },
  })
}
