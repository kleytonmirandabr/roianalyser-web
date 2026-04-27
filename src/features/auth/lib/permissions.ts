/**
 * Hierarquia de papéis:
 *
 *   MASTER  — dono da plataforma. Acesso a tudo, todos os tenants.
 *   ADMIN   — dono do tenant. Pode configurar workflow, perfis,
 *             custom fields, plans do próprio tenant.
 *   USER    — usuário comum. Vê o que o profile permite.
 *
 * Master é detectado por `user.isMaster`. Admin é detectado por uma
 * marca no profile (`profile.isAdmin === true`) ou por funcionalidades
 * específicas. Pra começar, qualquer master OU profile com nome
 * contendo "admin" (case-insensitive) é tratado como admin.
 */

import type { User } from '@/features/auth/types'
import type { GlobalProfile } from '@/features/admin/types'

export type RoleLevel = 'master' | 'admin' | 'user'

export function getRoleLevel(
  user: User | undefined | null,
  profiles: GlobalProfile[] = [],
): RoleLevel {
  if (!user) return 'user'
  if (user.isMaster) return 'master'
  const profile = profiles.find((p) => p.id === user.profileId)
  if (profile?.name?.toLowerCase().includes('admin')) return 'admin'
  return 'user'
}

export function isMaster(user: User | undefined | null): boolean {
  return user?.isMaster === true
}

export function hasFunctionality(
  user: User | undefined | null,
  profiles: GlobalProfile[],
  functionalityId: string,
): boolean {
  if (!user) return false
  if (user.isMaster) return true
  const profile = profiles.find((p) => p.id === user.profileId)
  return profile?.functionalityIds?.includes(functionalityId) ?? false
}
