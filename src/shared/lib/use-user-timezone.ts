import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'

/**
 * Resolve o timezone IANA do usuário logado:
 * 1. user.timezone do app-state (preferência salva)
 * 2. cliente.timezone (fallback do tenant)
 * 3. timezone do navegador (último recurso)
 */
export function useUserTimezone(): string {
  const { user } = useAuth()
  const { data } = useAppState()
  const users = (data?.users ?? []) as Array<{ id?: string; timezone?: string | null }>
  const me = users.find(u => String(u.id) === String(user?.id))
  if (me?.timezone) return me.timezone
  const clients = (data?.clients ?? []) as Array<{ id?: string; timezone?: string | null }>
  const client = clients.find((c: any) => String(c.id) === String(user?.activeClientId || user?.clientId))
  if (client?.timezone) return client.timezone
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}
