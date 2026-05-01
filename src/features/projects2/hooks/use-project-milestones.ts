import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectMilestonesApi } from '../milestones-api'
import type { CreateMilestoneInput, UpdateMilestoneInput } from '../milestones-types'

const KEY = (projectId: string) => ['project-milestones', projectId]

export function useProjectMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? KEY(projectId) : ['project-milestones', 'none'],
    queryFn: () => projectMilestonesApi.list(projectId as string),
    enabled: !!projectId,
  })
}

export function useCreateMilestone(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMilestoneInput) =>
      projectMilestonesApi.create(projectId as string, input),
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useUpdateMilestone(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMilestoneInput }) =>
      projectMilestonesApi.update(projectId as string, id, patch),
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useDeleteMilestone(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectMilestonesApi.delete(projectId as string, id),
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}
