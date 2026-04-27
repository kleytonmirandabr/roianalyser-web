/**
 * Guard de rota que valida role do usuário antes de renderizar children.
 *
 * Uso:
 *   <Route path="/admin/clients" element={
 *     <RequireRole level="master">
 *       <AdminClientsPage />
 *     </RequireRole>
 *   } />
 *
 * Hierarquia:
 *   - level="master" → só master vê
 *   - level="admin"  → admin OU master vê
 *   - level="user"   → qualquer logado (no-op, não bloqueia)
 *
 * Quando o role não bate, redireciona pra `/dashboard` (lugar seguro pra
 * qualquer usuário logado). Não mostra mensagem de erro — segurança por
 * obscurecimento + a sidebar já esconde o item, então user típico não
 * chega aqui. Quem chega digitou URL direta — silenciar é melhor que
 * sinalizar que existe a rota.
 */

import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  getRoleLevel,
  type RoleLevel,
} from '@/features/auth/lib/permissions'
import { useAppState } from '@/features/admin/hooks/use-app-state'

export function RequireRole({
  level,
  children,
}: {
  level: RoleLevel
  children: ReactNode
}) {
  const { user } = useAuth()
  const appState = useAppState()

  // Em loading, não bloqueia ainda — evita flash de redirect.
  if (!user || appState.isLoading) return <>{children}</>

  const userLevel = getRoleLevel(user, appState.data?.profiles ?? [])
  const allowed =
    level === 'user'
      ? true
      : level === 'admin'
        ? userLevel === 'admin' || userLevel === 'master'
        : userLevel === 'master'

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
