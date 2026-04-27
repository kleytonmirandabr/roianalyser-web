import {
  ExternalLink,
  FileSignature,
  FileText,
  NotebookPen,
  Plus,
  Receipt,
  ScrollText,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useProject } from '@/features/projects/hooks/use-project'
import { useUpdateProject } from '@/features/projects/hooks/use-update-project'
import {
  ATTACHMENT_KINDS,
  makeAttachment,
  readAttachments,
  serializeAttachments,
  type Attachment,
  type AttachmentKind,
} from '@/features/projects/lib/attachments'
import type { ProjectPayload } from '@/features/projects/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

const KIND_ICON: Record<AttachmentKind, typeof FileText> = {
  contract: FileSignature,
  proposal: FileText,
  invoice: Receipt,
  payment_receipt: Wallet,
  meeting_notes: NotebookPen,
  technical_spec: ScrollText,
  other: FileText,
}

export function ProjectAttachmentsView() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const update = useUpdateProject(params.id ?? '')
  const { user } = useAuth()

  const [items, setItems] = useState<Attachment[]>([])
  const [adding, setAdding] = useState<Attachment | null>(null)

  useEffect(() => {
    if (!project.data) return
    setItems(readAttachments(project.data.payload as Record<string, unknown> | null))
  }, [project.data])

  // Agrupa por kind pra UI organizada
  const grouped = useMemo(() => {
    const map = new Map<AttachmentKind, Attachment[]>()
    for (const k of ATTACHMENT_KINDS) map.set(k, [])
    for (const a of items) {
      const list = map.get(a.kind) ?? map.get('other')!
      list.push(a)
    }
    return map
  }, [items])

  async function persist(next: Attachment[]) {
    if (!project.data) return
    const base = (project.data.payload ?? {}) as Record<string, unknown>
    const payload: ProjectPayload = {
      ...base,
      attachments: serializeAttachments(next),
    }
    try {
      await update.mutateAsync({ payload })
      toastSaved(t('projects.detail.attachments.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function addAttachment(a: Attachment) {
    const next = [
      ...items,
      {
        ...a,
        addedAt: new Date().toISOString(),
        addedBy: user?.name ?? user?.email ?? user?.id,
      },
    ]
    setItems(next)
    setAdding(null)
    await persist(next)
  }

  async function removeAttachment(a: Attachment) {
    const ok = await confirm({
      title: t('projects.detail.attachments.deleteTitle'),
      description: t('projects.detail.attachments.deleteDesc', {
        title: a.title || a.url,
      }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    const next = items.filter((x) => x.id !== a.id)
    setItems(next)
    await persist(next)
  }

  if (!params.id) return null

  return (
    <div className="space-y-4">
      {project.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.detail.loadError')}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">
          {t('projects.detail.attachments.subtitle')}
        </p>
        <Button onClick={() => setAdding(makeAttachment())}>
          <Plus className="h-4 w-4" />
          <span>{t('projects.detail.attachments.new')}</span>
        </Button>
      </div>

      {items.length === 0 && !adding && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('projects.detail.attachments.empty')}
          </CardContent>
        </Card>
      )}

      {ATTACHMENT_KINDS.map((kind) => {
        const list = grouped.get(kind) ?? []
        if (list.length === 0) return null
        const Icon = KIND_ICON[kind]
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="h-4 w-4" />
                {t(`projects.detail.attachments.kind.${kind}`)}
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
                  {list.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      {a.title || a.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {a.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.addedBy && <>{a.addedBy} · </>}
                      {a.addedAt &&
                        new Date(a.addedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <IconTooltip label={t('catalogs.detail.delete')}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(a)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </IconTooltip>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      {adding && (
        <AddAttachmentForm
          initial={adding}
          onCancel={() => setAdding(null)}
          onSave={addAttachment}
        />
      )}
    </div>
  )
}

function AddAttachmentForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Attachment
  onCancel: () => void
  onSave: (a: Attachment) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Attachment>(initial)

  function patch<K extends keyof Attachment>(key: K, value: Attachment[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('projects.detail.attachments.formTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave(draft)
          }}
          className="grid gap-3 md:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label>{t('projects.detail.attachments.field.kind')}</Label>
            <select
              value={draft.kind}
              onChange={(e) =>
                patch('kind', e.target.value as AttachmentKind)
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ATTACHMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`projects.detail.attachments.kind.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('projects.detail.attachments.field.title')}*</Label>
            <Input
              value={draft.title}
              onChange={(e) => patch('title', e.target.value)}
              required
              placeholder={t('projects.detail.attachments.titlePlaceholder')}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('projects.detail.attachments.field.url')}*</Label>
            <Input
              type="url"
              value={draft.url}
              onChange={(e) => patch('url', e.target.value)}
              required
              placeholder="https://drive.google.com/..."
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('projects.detail.attachments.field.description')}</Label>
            <Input
              value={draft.description ?? ''}
              onChange={(e) => patch('description', e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!draft.title || !draft.url}>
              {t('common.submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
