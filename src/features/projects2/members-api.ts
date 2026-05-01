import { api } from '@/shared/api/client'
import type { ProjectMember, ProjectMemberRole } from './members-types'

export const projectMembersApi = {
  list: (projectId: string) =>
    api.get<{ items: ProjectMember[] }>(`/projects2/${encodeURIComponent(projectId)}/members`)
      .then(r => r.items),

  invite: (projectId: string, input: { userId: string; role: ProjectMemberRole }) =>
    api.post<{ item: ProjectMember }>(`/projects2/${encodeURIComponent(projectId)}/members`, input)
      .then(r => r.item),

  updateRole: (projectId: string, memberId: string, role: ProjectMemberRole) =>
    api.patch<{ item: ProjectMember }>(
      `/projects2/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
      { role },
    ).then(r => r.item),

  remove: (projectId: string, memberId: string) =>
    api.delete<void>(
      `/projects2/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
    ),
}
