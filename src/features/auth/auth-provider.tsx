import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  clearToken,
  readActiveTenant,
  readToken,
  writeActiveTenant,
  writeToken,
} from '@/shared/api/client'

import { authApi } from './api'
import type { AccessibleClient, Profile, SessionPayload, User } from './types'

type AuthStatus =
  | 'loading' // restaurando sessão via GET /session
  | 'authenticated'
  | 'unauthenticated'

export type AuthContextValue = {
  status: AuthStatus
  user: User | null
  profile: Profile | null
  /** Multi-tenant: lista de clients acessíveis. Vazio = não veio do backend. */
  accessibleClients: AccessibleClient[]
  /** Multi-tenant: clientId ativo na sessão (default = user.clientId). */
  activeClientId: string | null
  /**
   * Estabelece sessão após login bem-sucedido (ou challenge MFA resolvido).
   * `remember=true` persiste o token em localStorage; caso contrário sessionStorage.
   */
  setSession: (payload: SessionPayload, remember: boolean) => void
  /** Limpa sessão local e notifica o backend. */
  signOut: () => Promise<void>
  /** Chamado por interceptor ao receber 401 — limpa estado sem chamar backend. */
  forceSignOut: () => void
  /**
   * Multi-tenant: troca o tenant ativo. Atualiza header X-Active-Tenant,
   * persiste em users.active_client_id e invalida cache do React Query
   * (todas as queries refetcham com o novo tenant).
   */
  switchTenant: (clientId: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [accessibleClients, setAccessibleClients] = useState<AccessibleClient[]>([])
  const [activeClientId, setActiveClientId] = useState<string | null>(() =>
    readActiveTenant(),
  )
  const [status, setStatus] = useState<AuthStatus>(() =>
    readToken() ? 'loading' : 'unauthenticated',
  )

  /* Tenta restaurar sessão no boot quando há token persistido. */
  useEffect(() => {
    if (!readToken()) return

    let cancelled = false
    authApi
      .session()
      .then((payload) => {
        if (cancelled) return
        setUser(payload.user)
        setProfile(payload.profile)
        setAccessibleClients(payload.accessibleClients ?? [])
        // Tenant ativo: prioriza o que o backend confirmou (já validado),
        // senão usa o que tava em localStorage, senão o clientId default.
        const resolved =
          payload.activeClientId ?? readActiveTenant() ?? payload.user.clientId ?? null
        setActiveClientId(resolved)
        if (resolved) writeActiveTenant(resolved)
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        clearToken()
        writeActiveTenant(null)
        setUser(null)
        setProfile(null)
        setAccessibleClients([])
        setActiveClientId(null)
        setStatus('unauthenticated')
      })

    return () => {
      cancelled = true
    }
  }, [])

  /* Escuta evento global disparado pelo client.ts ao receber 401. */
  useEffect(() => {
    const handler = () => {
      clearToken()
      writeActiveTenant(null)
      setUser(null)
      setProfile(null)
      setAccessibleClients([])
      setActiveClientId(null)
      setStatus('unauthenticated')
      queryClient.clear()
    }
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [queryClient])

  const setSession = useCallback(
    (payload: SessionPayload, remember: boolean) => {
      writeToken(payload.token, remember)
      setUser(payload.user)
      setProfile(payload.profile)
      setAccessibleClients(payload.accessibleClients ?? [])
      const resolved =
        payload.activeClientId ?? readActiveTenant() ?? payload.user.clientId ?? null
      setActiveClientId(resolved)
      if (resolved) writeActiveTenant(resolved)
      setStatus('authenticated')
    },
    [],
  )

  const forceSignOut = useCallback(() => {
    clearToken()
    writeActiveTenant(null)
    setUser(null)
    setProfile(null)
    setAccessibleClients([])
    setActiveClientId(null)
    setStatus('unauthenticated')
    queryClient.clear()
  }, [queryClient])

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignorar erro do logout remoto — limpeza local sempre acontece.
    }
    forceSignOut()
  }, [forceSignOut])

  const switchTenant = useCallback(
    async (clientId: string) => {
      // Update otimista do header (request seguinte já vai com o novo tenant).
      writeActiveTenant(clientId)
      setActiveClientId(clientId)
      try {
        const payload = await authApi.switchTenant(clientId)
        setUser(payload.user)
        setProfile(payload.profile)
        setAccessibleClients(payload.accessibleClients ?? [])
        if (payload.activeClientId) {
          writeActiveTenant(payload.activeClientId)
          setActiveClientId(payload.activeClientId)
        }
      } finally {
        // Invalida tudo — todas as queries refetcham com X-Active-Tenant novo.
        queryClient.clear()
      }
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      accessibleClients,
      activeClientId,
      setSession,
      signOut,
      forceSignOut,
      switchTenant,
    }),
    [
      status,
      user,
      profile,
      accessibleClients,
      activeClientId,
      setSession,
      signOut,
      forceSignOut,
      switchTenant,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
