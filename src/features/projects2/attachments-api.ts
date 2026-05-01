import { api } from '@/shared/api/client'
import type { ProjectAttachment, CreateProjectAttachmentInput } from './attachments-types'

export const projectAttachmentsApi = {
  list: (projectId: string) =>
    api
      .get<{ items: ProjectAttachment[] }>(`/projects2/${encodeURIComponent(projectId)}/attachments`)
      .then((r) => r.items),

  create: (projectId: string, input: CreateProjectAttachmentInput) =>
    api
      .post<{ item: ProjectAttachment }>(
        `/projects2/${encodeURIComponent(projectId)}/attachments`,
        input,
      )
      .then((r) => r.item),

  delete: (projectId: string, attachmentId: string) =>
    api.delete<void>(
      `/projects2/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}`,
    ),

  downloadUrl: (projectId: string, attachmentId: string) =>
    `/api/projects2/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}`,
}
