import { api } from '@/shared/api/client'

export interface TaskComment {
  id: string
  milestoneId: string
  clientId: string
  userId: string | null
  userName: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export const taskCommentsApi = {
  list: (milestoneId: string) =>
    api
      .get<{ comments: TaskComment[] }>(`/milestones/${encodeURIComponent(milestoneId)}/comments`)
      .then((r) => r.comments),

  create: (milestoneId: string, content: string) =>
    api
      .post<{ comment: TaskComment }>(
        `/milestones/${encodeURIComponent(milestoneId)}/comments`,
        { content },
      )
      .then((r) => r.comment),

  delete: (milestoneId: string, commentId: string) =>
    api.delete<void>(
      `/milestones/${encodeURIComponent(milestoneId)}/comments/${encodeURIComponent(commentId)}`,
    ),
}
