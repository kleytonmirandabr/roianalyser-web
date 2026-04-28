/**
 * AuditInfoFooter — bloco read-only com criado em / atualizado em
 * (formatados pt-BR). Usado em drawers de edição como informativo.
 */
import { Clock, Edit3 } from 'lucide-react'

function fmt(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

interface Props {
  createdAt?: string | null
  updatedAt?: string | null
  createdByName?: string | null
  updatedByName?: string | null
}

export function AuditInfoFooter({ createdAt, updatedAt, createdByName, updatedByName }: Props) {
  if (!createdAt && !updatedAt) return null
  return (
    <div className="border-t pt-3 mt-4 text-xs text-muted-foreground space-y-1">
      {createdAt && (
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3" />
          <span>Criado em <strong>{fmt(createdAt)}</strong>{createdByName ? <> por <strong>{createdByName}</strong></> : null}</span>
        </div>
      )}
      {updatedAt && updatedAt !== createdAt && (
        <div className="flex items-center gap-2">
          <Edit3 className="h-3 w-3" />
          <span>Atualizado em <strong>{fmt(updatedAt)}</strong>{updatedByName ? <> por <strong>{updatedByName}</strong></> : null}</span>
        </div>
      )}
    </div>
  )
}
