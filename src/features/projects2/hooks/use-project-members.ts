import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectMembersApi } from '../members-api'
import type { ProjectMemberRole } from '../members-types'

const KEY = (projectId: string) => ['project-members', projectId]

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? KEY(projectId) : ['project-members', 'none'],
    queryFn: () => projectMembersApi.list(projectId as string),
    enabled: !!projectId,
  })
}

export function useInviteMember(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; role: ProjectMemberRole }) =>
      projectMembersApi.invite(projectId as string, input),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}

export function useUpdateMemberRole(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: ProjectMemberRole }) =>
      projectMembersApi.updateRole(projectId as string, id, role),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}

export function useRemoveMember(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectMembersApi.remove(projectId as string, id),
    onSuccess: () => projectId && qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}
