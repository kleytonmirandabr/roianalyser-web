/**
 * Bloco de anexos do Projeto. Mesma estrutura do AttachmentsCard de Contrato,
 * apontando pra hooks/api de projects2.
 */
import { Eye, FileText, Image as ImageIcon, Paperclip, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  PROJECT_ATTACHMENT_KIND_LABELS,
  type ProjectAttachmentKind,
} from '@/features/projects2/attachments-types'
import { projectAttachmentsApi } from '@/features/projects2/attachments-api'
import {
  fileToUploadInput,
  useProjectAttachments,
  useDeleteProjectAttachment,
  useUploadProjectAttachment,
} from '@/features/projects2/hooks/use-project-attachments'
import { TOKEN_STORAGE_KEY } from '@/shared/api/client'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx'
const MIME_OK = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return iso }
}

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon
  return FileText
}

export function ProjectAttachmentsCard({ projectId }: { projectId: string | undefined }) {
  const list = useProjectAttachments(projectId)
  const upload = useUploadProjectAttachment(projectId)
  const remove = useDeleteProjectAttachment(projectId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingKind, setPendingKind] = useState<ProjectAttachmentKind>('plan')
  const [pendingNotes, setPendingNotes] = useState('')
  const [previewing, setPreviewing] = useState<{ id: string; filename: string; mime: string } | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)

  const items = list.data || []

  function pickFile(file: File | null | undefined) {
    if (!file) return
    if (!MIME_OK.has(file.type)) {
      toastError(`Tipo não suportado: ${file.type || file.name}`)
      return
    }
    if (file.size > MAX_BYTES) {
      toastError(`Arquivo excede 10MB (${fmtSize(file.size)}).`)
      return
    }
    setPendingFile(file)
    const lower = file.name.toLowerCase()
    if (lower.includes('escopo')) setPendingKind('scope')
    else if (lower.includes('relat') || lower.includes('report')) setPendingKind('report')
    else if (lower.includes('nota') || lower.includes('nf')) setPendingKind('invoice')
    else setPendingKind('plan')
    setPendingNotes('')
  }

  async function doUpload() {
    if (!pendingFile || !projectId) return
    try {
      const { mime, dataBase64 } = await fileToUploadInput(pendingFile)
      await upload.mutateAsync({
        filename: pendingFile.name,
        mime,
        kind: pendingKind,
        notes: pendingNotes || undefined,
        dataBase64,
      })
      toastSaved('Arquivo anexado')
      setPendingFile(null)
      setPendingNotes('')
    } catch (err) {
      toastError(`Erro no upload: ${(err as Error).message}`)
    }
  }

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onOver = (e: DragEvent) => { e.preventDefault(); el.classList.add('ring-2', 'ring-primary/50') }
    const onLeave = () => el.classList.remove('ring-2', 'ring-primary/50')
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      el.classList.remove('ring-2', 'ring-primary/50')
      const f = e.dataTransfer?.files?.[0]
      if (f) pickFile(f)
    }
    el.addEventListener('dragover', onOver)
    el.addEventListener('dragleave', onLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onOver)
      el.removeEventListener('dragleave', onLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [])

  async function openPreview(it: { id: string; filename: string; mime: string }) {
    if (!projectId) return
    setPreviewing(it)
    setPreviewBlobUrl(null)
    try {
      const url = projectAttachmentsApi.downloadUrl(projectId, it.id)
      const token = localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY) || ''
      const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      setPreviewBlobUrl(URL.createObjectURL(blob))
    } catch (err) {
      toastError(`Preview falhou: ${(err as Error).message}`)
      setPreviewing(null)
    }
  }
  function closePreview() {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
    setPreviewBlobUrl(null)
    setPreviewing(null)
  }

  async function handleDelete(it: { id: string; filename: string }) {
    if (!projectId) return
    const ok = await confirm({
      title: 'Remover anexo',
      description: `Remover "${it.filename}"? Esta ação é definitiva.`,
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(it.id)
      toastDeleted('Anexo removido')
    } catch (err) {
      toastError(`Erro: ${(err as Error).message}`)
    }
  }

  const kindOptions = (Object.entries(PROJECT_ATTACHMENT_KIND_LABELS) as Array<[ProjectAttachmentKind, string]>).map(
    ([value, label]) => ({ value, label }),
  )

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
            Documentos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Escopo, plano, relatórios, notas. PDF, PNG, JPG ou DOCX (máx. 10MB).
          </p>
        </div>
      </div>

      <div
        ref={dropRef}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">Arraste um arquivo aqui ou clique para escolher</p>
        <p className="text-xs text-muted-foreground mt-1">PDF · PNG · JPG · DOCX (máx. 10MB)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>

      {pendingFile && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <div className="font-medium">{pendingFile.name}</div>
                <div className="text-xs text-muted-foreground">{fmtSize(pendingFile.size)} · {pendingFile.type || '—'}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setPendingFile(null)} title="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Combobox value={pendingKind} onChange={(v) => setPendingKind(v as ProjectAttachmentKind)} options={kindOptions} />
            </div>
            <div>
              <Label htmlFor="att-notes">Observação (opcional)</Label>
              <Input
                id="att-notes"
                value={pendingNotes}
                onChange={(e) => setPendingNotes(e.target.value)}
                placeholder="Ex.: Plano consolidado v2 aprovado em..."
                maxLength={500}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setPendingFile(null)} disabled={upload.isPending}>Cancelar</Button>
            <Button onClick={doUpload} disabled={upload.isPending}>
              {upload.isPending ? 'Enviando...' : 'Anexar arquivo'}
            </Button>
          </div>
        </div>
      )}

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">Nenhum documento anexado.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const Icon = iconFor(it.mime)
            return (
              <li key={it.id} className="rounded-md border bg-card hover:bg-muted/30 transition-colors">
                <div className="p-3 flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <div className="rounded bg-muted/50 p-2 shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.filename}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-medium uppercase tracking-wide">{PROJECT_ATTACHMENT_KIND_LABELS[it.kind]}</span>
                      <span>·</span>
                      <span>{fmtSize(it.sizeBytes)}</span>
                      <span>·</span>
                      <span>{fmtDate(it.uploadedAt)}</span>
                    </div>
                    {it.notes && <div className="text-xs text-muted-foreground mt-1 italic">{it.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" title="Visualizar" onClick={() => openPreview(it)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Remover" onClick={() => handleDelete(it)} disabled={remove.isPending}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={!!previewing} onOpenChange={(o) => { if (!o) closePreview() }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewing?.filename}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted/20 rounded">
            {!previewBlobUrl ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando preview...</div>
            ) : previewing?.mime.startsWith('image/') ? (
              <img src={previewBlobUrl} alt={previewing.filename} className="w-full h-full object-contain" />
            ) : previewing?.mime === 'application/pdf' ? (
              <iframe src={previewBlobUrl} className="w-full h-full border-0" title={previewing.filename} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-sm">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p>Preview não disponível para este tipo. Baixe o arquivo:</p>
                <Button asChild>
                  <a href={previewBlobUrl} download={previewing?.filename}>Baixar {previewing?.filename}</a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
