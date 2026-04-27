/**
 * Anexos do projeto via link externo (Drive, Dropbox, etc).
 * Sem upload nativo: o user cola URL e categoriza.
 * Persistido em payload.attachments.
 */

export type AttachmentKind =
  | 'contract'
  | 'proposal'
  | 'invoice'
  | 'payment_receipt'
  | 'meeting_notes'
  | 'technical_spec'
  | 'other'

export const ATTACHMENT_KINDS: AttachmentKind[] = [
  'contract',
  'proposal',
  'invoice',
  'payment_receipt',
  'meeting_notes',
  'technical_spec',
  'other',
]

export type Attachment = {
  id: string
  kind: AttachmentKind
  title: string
  url: string
  description?: string
  addedAt?: string
  addedBy?: string
}

let __idCounter = 0
function nextId(): string {
  __idCounter += 1
  return `att_${Date.now().toString(36)}_${__idCounter}`
}

export function makeAttachment(partial?: Partial<Attachment>): Attachment {
  return {
    id: partial?.id ?? nextId(),
    kind: ATTACHMENT_KINDS.includes(partial?.kind as AttachmentKind)
      ? (partial!.kind as AttachmentKind)
      : 'other',
    title: partial?.title ?? '',
    url: partial?.url ?? '',
    description: partial?.description,
    addedAt: partial?.addedAt,
    addedBy: partial?.addedBy,
  }
}

export function readAttachments(
  payload: Record<string, unknown> | null | undefined,
): Attachment[] {
  if (!payload) return []
  const raw = payload.attachments
  if (!Array.isArray(raw)) return []
  return raw.map((a) => {
    const obj = a as Partial<Attachment>
    return makeAttachment({
      id: typeof obj.id === 'string' ? obj.id : undefined,
      kind: obj.kind,
      title: typeof obj.title === 'string' ? obj.title : '',
      url: typeof obj.url === 'string' ? obj.url : '',
      description:
        typeof obj.description === 'string' ? obj.description : undefined,
      addedAt: typeof obj.addedAt === 'string' ? obj.addedAt : undefined,
      addedBy: typeof obj.addedBy === 'string' ? obj.addedBy : undefined,
    })
  })
}

export function serializeAttachments(items: Attachment[]) {
  return items.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title,
    url: a.url,
    description: a.description,
    addedAt: a.addedAt,
    addedBy: a.addedBy,
  }))
}
