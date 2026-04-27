import { useMutation } from '@tanstack/react-query'

import { api } from '@/shared/api/client'

import type { User } from '../types'
import { useAuth } from './use-auth'

export type UpdateProfileInput = {
  name?: string
  email?: string
  defaultLanguage?: string
  phone?: string | null
  role?: string | null
}

/**
 * Atualiza o próprio perfil do usuário. O backend valida que o caller só
 * pode editar a si mesmo (enforceSelfOrMaster).
 *
 * Após sucesso, repropaga o user atualizado pelo AuthContext, mantendo
 * profile e token correntes.
 */
export function useUpdateProfile() {
  const { user, profile, setSession } = useAuth()

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!user?.id) throw new Error('Sem sessão ativa')
      const response = await api.put<{ item: User }>(
        `/users/${encodeURIComponent(user.id)}`,
        input,
      )
      return response.item
    },
    onSuccess: (updated) => {
      const token =
        localStorage.getItem('roi.auth.token') ||
        sessionStorage.getItem('roi.auth.token') ||
        ''
      const remember = !!localStorage.getItem('roi.auth.token')
      if (!token) return
      setSession({ token, user: updated, profile }, remember)
    },
  })
}
