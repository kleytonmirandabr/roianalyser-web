/** Tipos de anexo de Projeto. */

export type ProjectAttachmentKind = 'scope' | 'plan' | 'report' | 'invoice' | 'other'

export const PROJECT_ATTACHMENT_KIND_LABELS: Record<ProjectAttachmentKind, string> = {
  scope: 'Escopo',
  plan: 'Plano de projeto',
  report: 'Relatório',
  invoice: 'Nota fiscal',
  other: 'Outro',
}

export type ProjectAttachment = {
  id: string
  tenantId: string
  projectId: string
  filename: string
  mime: string
  sizeBytes: number
  storagePath: string
  kind: ProjectAttachmentKind
  notes: string | null
  uploadedBy: string
  uploadedAt: string
  deletedAt: string | null
  deletedBy: string | null
}

export type CreateProjectAttachmentInput = {
  filename: string
  mime: string
  kind: ProjectAttachmentKind
  notes?: string
  /** dados em base64 (sem prefixo data:...) */
  dataBase64: string
}
