import { useMutation } from '@tanstack/react-query'

import { authApi, type LoginInput } from '../api'
import {
  isMfaChallenge,
  isMfaSetupRequired,
  isSessionPayload,
  type LoginResponse,
} from '../types'
import { useAuth } from './use-auth'

export type LoginVariables = LoginInput & {
  /** Marca "Lembrar-me" do formulário. */
  remember: boolean
}

/**
 * Wrapper do /api/auth/login que:
 * - Estabelece a sessão local se o backend retornou token direto.
 * - Retorna o response bruto para o caller decidir o fluxo de MFA
 *   (challenge ou setup) quando ainda não há token.
 *
 * A decisão de navegação fica no componente (LoginPage) — este hook
 * só orquestra a chamada e a criação da sessão quando aplicável.
 */
export function useLogin() {
  const { setSession } = useAuth()

  return useMutation<LoginResponse, Error, LoginVariables>({
    mutationFn: async ({ login, password }) =>
      authApi.login({ login, password }),
    onSuccess: (response, variables) => {
      if (isSessionPayload(response)) {
        setSession(response, variables.remember)
      }
      // Caso contrário (MFA challenge/setup), o componente que chamou
      // cuida de navegar para /mfa passando o mfaToken.
    },
  })
}

export { isMfaChallenge, isMfaSetupRequired, isSessionPayload }
