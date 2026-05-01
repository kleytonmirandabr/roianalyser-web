/** Tipos de anexo de contrato. */

export type AttachmentKind = 'contract' | 'amendment' | 'receipt' | 'other'

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  contract: 'Contrato assinado',
  amendment: 'Aditivo',
  receipt: 'Comprovante',
  other: 'Outro',
}

export type ContractAttachment = {
  id: string
  tenantId: string
  contractId: string
  filename: string
  mime: string
  sizeBytes: number
  storagePath: string
  kind: AttachmentKind
  notes: string | null
  uploadedBy: string
  uploadedAt: string
  deletedAt: string | null
  deletedBy: string | null
}

export type CreateAttachmentInput = {
  filename: string
  mime: string
  kind: AttachmentKind
  notes?: string
  /** dados em base64 (sem prefixo data:...) */
  dataBase64: string
}
