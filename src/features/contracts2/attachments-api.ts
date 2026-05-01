import { api } from '@/shared/api/client'
import type { ContractAttachment, CreateAttachmentInput } from './attachments-types'

export const contractAttachmentsApi = {
  list: (contractId: string) =>
    api
      .get<{ items: ContractAttachment[] }>(`/contracts2/${encodeURIComponent(contractId)}/attachments`)
      .then((r) => r.items),

  create: (contractId: string, input: CreateAttachmentInput) =>
    api
      .post<{ item: ContractAttachment }>(
        `/contracts2/${encodeURIComponent(contractId)}/attachments`,
        input,
      )
      .then((r) => r.item),

  delete: (contractId: string, attachmentId: string) =>
    api.delete<void>(
      `/contracts2/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(attachmentId)}`,
    ),

  /**
   * URL relativa do endpoint de download (bytes raw). Nginx serve com auth.
   * Quando precisar de blob direto, usar `api.getBlob(downloadUrl)`.
   */
  downloadUrl: (contractId: string, attachmentId: string) =>
    `/api/contracts2/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(attachmentId)}`,
}
