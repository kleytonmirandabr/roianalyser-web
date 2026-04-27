import { Check, MessageSquare, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { UserAvatar } from '@/features/admin/components/user-select'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useProject } from '@/features/projects/hooks/use-project'
import { useUpdateProject } from '@/features/projects/hooks/use-update-project'
import { logEvent } from '@/features/projects/lib/activity-log'
import {
  addComment,
  makeComment,
  readComments,
  removeComment,
  resolveComment,
  summarizeComments,
  unresolveComment,
  updateComment,
  type ProjectComment,
} from '@/features/projects/lib/comments'
import type { ProjectPayload } from '@/features/projects/types'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { cn } from '@/shared/lib/cn'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'

/**
 * Aba "Comentários" do projeto. Feed cronológico (mais recente primeiro)
 * onde o time deixa observações livres. Diferente do histórico (eventos
 * automáticos) — aqui é texto humano.
 *
 * Comportamento:
 * - Caixa de texto fixa no topo pra novo comentário (Cmd/Ctrl+Enter envia).
 * - Cada comentário pode ser editado pelo autor, resolvido por qualquer um
 *   e excluído pelo autor (master pode excluir qualquer um).
 * - Comentários resolvidos ficam atenuados visualmente, mas continuam
 *   visíveis pra auditoria — só toggleable via "reabrir".
 * - Cada criação registra evento 'comment_added' no activityLog do projeto
 *   (aparece no /history).
 */
export function ProjectCommentsView() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const update = useUpdateProject(params.id ?? '')
  const { user } = useAuth()

  const [draftBody, setDraftBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const comments = useMemo(
    () => readComments(project.data?.payload as Record<string, unknown> | null),
    [project.data],
  )
  const summary = useMemo(() => summarizeComments(comments), [comments])
  const visible = showResolved ? comments : comments.filter((c) => !c.resolvedAt)

  /**
   * Persiste a lista de comentários junto com (opcionalmente) um novo evento
   * de activityLog. Mantemos as duas mutações no mesmo PUT pra evitar dois
   * round-trips e estados intermediários inconsistentes.
   */
  async function persist(
    nextList: ProjectComment[],
    activityEvent?: Parameters<typeof logEvent>[1],
    successMsg?: string,
  ) {
    if (!project.data) return
    const basePayload = (project.data.payload ?? {}) as Record<string, unknown>
    const payload: ProjectPayload = {
      ...basePayload,
      comments: nextList,
    }
    if (activityEvent) {
      payload.activityLog = logEvent(basePayload, activityEvent)
    }
    try {
      await update.mutateAsync({ payload })
      if (successMsg) toastSaved(successMsg)
    } catch (err) {
      toastError(err)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = draftBody.trim()
    if (!body) return
    const newComment = makeComment({
      body,
      authorId: user?.id,
      authorName: user?.name ?? user?.email ?? 'Anônimo',
    })
    setDraftBody('')
    await persist(
      addComment(comments, newComment),
      {
        type: 'comment_added',
        message: t('projects.detail.comments.eventAdded', {
          author: newComment.authorName,
        }),
        actorId: user?.id,
        actorName: user?.name ?? user?.email,
      },
      t('projects.detail.comments.added'),
    )
  }

  function startEdit(c: ProjectComment) {
    setEditingId(c.id)
    setEditingBody(c.body)
  }
  function cancelEdit() {
    setEditingId(null)
    setEditingBody('')
  }
  async function saveEdit(id: string) {
    const body = editingBody.trim()
    if (!body) return
    setEditingId(null)
    await persist(
      updateComment(comments, id, { body }),
      undefined,
      t('projects.detail.comments.edited'),
    )
  }

  async function handleResolve(c: ProjectComment) {
    await persist(
      resolveComment(comments, c.id, { id: user?.id, name: user?.name ?? user?.email }),
      {
        type: 'comment_resolved',
        message: t('projects.detail.comments.eventResolved', {
          author: c.authorName ?? '',
        }),
        actorId: user?.id,
        actorName: user?.name ?? user?.email,
      },
      t('projects.detail.comments.resolved'),
    )
  }

  async function handleUnresolve(c: ProjectComment) {
    await persist(
      unresolveComment(comments, c.id),
      undefined,
      t('projects.detail.comments.reopened'),
    )
  }

  async function handleDelete(c: ProjectComment) {
    const ok = await confirm({
      title: t('projects.detail.comments.deleteTitle'),
      description: t('projects.detail.comments.deleteDesc'),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      const basePayload = (project.data!.payload ?? {}) as Record<string, unknown>
      const payload: ProjectPayload = {
        ...basePayload,
        comments: removeComment(comments, c.id),
      }
      await update.mutateAsync({ payload })
      toastDeleted(t('projects.detail.comments.deleted'))
    } catch (err) {
      toastError(err)
    }
  }

  /** Determina se o usuário corrente pode editar/excluir esse comentário. */
  function canModify(c: ProjectComment): boolean {
    if (!user) return false
    if (user.isMaster) return true
    return !!c.authorId && c.authorId === user.id
  }

  return (
    <div className="space-y-4">
      {project.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.detail.loadError')}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        {t('projects.detail.comments.subtitle')}
      </p>

      {/* Composer fixo no topo. Cmd/Ctrl+Enter envia. */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit(e as unknown as React.FormEvent)
                }
              }}
              placeholder={t('projects.detail.comments.placeholder')}
              className="min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={update.isPending || project.isLoading}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                {t('projects.detail.comments.shortcutHint')}
              </p>
              <Button
                type="submit"
                disabled={!draftBody.trim() || update.isPending}
                size="sm"
              >
                {t('projects.detail.comments.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Resumo + filtro */}
      {summary.total > 0 && (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>
            {t('projects.detail.comments.summary', {
              open: summary.open,
              resolved: summary.resolved,
            })}
          </span>
          {summary.resolved > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
              />
              {t('projects.detail.comments.showResolved')}
            </label>
          )}
        </div>
      )}

      {/* Feed */}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-30" />
            {summary.total === 0
              ? t('projects.detail.comments.empty')
              : t('projects.detail.comments.allResolved')}
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {visible.map((c) => {
            const isEditing = editingId === c.id
            const isResolved = !!c.resolvedAt
            return (
              <li key={c.id}>
                <Card className={cn(isResolved && 'opacity-70')}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <UserAvatar name={c.authorName ?? '?'} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-medium text-foreground">
                            {c.authorName ?? t('projects.detail.comments.unknown')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString()}
                          </span>
                          {c.updatedAt && (
                            <span className="text-xs text-muted-foreground">
                              · {t('projects.detail.comments.editedAt')}
                            </span>
                          )}
                          {isResolved && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              {t('projects.detail.comments.resolvedBadge')}
                            </span>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              className="min-h-[60px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEdit(c.id)}
                                disabled={!editingBody.trim() || update.isPending}
                              >
                                {t('common.submit')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                              >
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                            {c.body}
                          </p>
                        )}
                      </div>

                      {/* Ações — só aparecem fora do modo edit */}
                      {!isEditing && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          {!isResolved ? (
                            <IconTooltip
                              label={t('projects.detail.comments.resolve')}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResolve(c)}
                                disabled={update.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </IconTooltip>
                          ) : (
                            <IconTooltip
                              label={t('projects.detail.comments.reopen')}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUnresolve(c)}
                                disabled={update.isPending}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </IconTooltip>
                          )}
                          {canModify(c) && (
                            <>
                              <IconTooltip label={t('catalogs.detail.edit')}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEdit(c)}
                                  disabled={update.isPending}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </IconTooltip>
                              <IconTooltip label={t('catalogs.detail.delete')}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(c)}
                                  disabled={update.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </IconTooltip>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
