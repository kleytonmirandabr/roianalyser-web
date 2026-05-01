/**
 * Resolve o role efetivo do usuário corrente num projeto.
 *
 * Regras (espelham backend `resolveProjectRole`):
 *   - Manager do projeto → owner
 *   - Membro explícito em project_members → role da tabela
 *   - Sem membro mas generalAccess === 'tenant_edit' → editor
 *   - Sem membro mas generalAccess === 'tenant_view' → viewer
 *   - 'private' sem membro → null (sem acesso)
 */
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useProjectMembers } from './use-project-members'
import type { Project } from '../types'
import type { ProjectMemberRole } from '../members-types'

export type ResolvedRole = ProjectMemberRole | null

const RANK: Record<ProjectMemberRole, number> = { owner: 3, editor: 2, viewer: 1 }

export function useProjectRole(project: Project | undefined | null): {
  role: ResolvedRole
  canEdit: boolean
  canManage: boolean
  loading: boolean
} {
  const { user } = useAuth()
  const members = useProjectMembers(project?.id)

  if (!project || !user) {
    return { role: null, canEdit: false, canManage: false, loading: members.isLoading }
  }

  // Manager direto = owner
  if (String(project.managerId) === String(user.id)) {
    return { role: 'owner', canEdit: true, canManage: true, loading: false }
  }

  const list = members.data || []
  const found = list.find((m) => String(m.userId) === String(user.id))

  let role: ResolvedRole = found ? found.role : null
  if (!role) {
    if (project.generalAccess === 'tenant_edit') role = 'editor'
    else if (project.generalAccess === 'tenant_view') role = 'viewer'
    else role = null
  }

  const canEdit = role !== null && RANK[role] >= RANK.editor
  const canManage = role === 'owner'
  return { role, canEdit, canManage, loading: members.isLoading }
}
