import { api } from '@/shared/api/client'
import type { CreateMilestoneInput, ProjectMilestone, UpdateMilestoneInput } from './milestones-types'

export const projectMilestonesApi = {
  list: (projectId: string) =>
    api
      .get<{ items: ProjectMilestone[] }>(`/projects2/${encodeURIComponent(projectId)}/milestones`)
      .then((r) => r.items),

  create: (projectId: string, input: CreateMilestoneInput) =>
    api
      .post<{ item: ProjectMilestone }>(
        `/projects2/${encodeURIComponent(projectId)}/milestones`,
        input,
      )
      .then((r) => r.item),

  update: (projectId: string, milestoneId: string, patch: UpdateMilestoneInput) =>
    api
      .patch<{ item: ProjectMilestone }>(
        `/projects2/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
        patch,
      )
      .then((r) => r.item),

  delete: (projectId: string, milestoneId: string) =>
    api.delete<void>(
      `/projects2/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
    ),
}
