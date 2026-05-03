/**
 * Painel lateral (drawer) de comentários de uma tarefa.
 * Abre ao clicar no título da task na tabela.
 */
import { MessageSquare, Send, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { taskCommentsApi, type TaskComment } from '@/features/projects2/task-comments-api'
import type { ProjectMilestone } from '@/features/projects2/milestones-types'

interface Props {
  task: ProjectMilestone
  canEdit: boolean
  currentUserId?: string
  onClose: () => void
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function fmtDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return iso }
}

export function TaskCommentPanel({ task, canEdit, currentUserId, onClose }: Props) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [draft,    setDraft]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLoading(true)
    taskCommentsApi.list(task.id)
      .then(setComments)
      .catch(() => setError('Erro ao carregar comentários'))
      .finally(() => setLoading(false))
  }, [task.id])

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments, loading])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSubmit() {
    if (!draft.trim() || saving) return
    setSaving(true)
    try {
      const comment = await taskCommentsApi.create(task.id, draft.trim())
      setComments(prev => [...prev, comment])
      setDraft('')
    } catch {
      setError('Erro ao salvar comentário')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(comment: TaskComment) {
    if (!confirm('Remover este comentário?')) return
    try {
      await taskCommentsApi.delete(task.id, comment.id)
      setComments(prev => prev.filter(c => c.id !== comment.id))
    } catch {
      setError('Erro ao remover comentário')
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3 border-b shrink-0">
          <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Comentários</p>
            <p className="text-sm font-medium truncate" title={task.title}>{task.title}</p>
          </div>
          <button type="button" onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              Carregando…
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhum comentário ainda.</p>
              <p className="text-xs mt-1 opacity-70">Seja o primeiro a comentar.</p>
            </div>
          )}

          {comments.map(comment => {
            const isOwn = currentUserId && String(comment.userId) === String(currentUserId)
            return (
              <div key={comment.id} className="flex gap-2.5 group">
                {/* Avatar */}
                <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                  {initials(comment.userName)}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-semibold">{comment.userName ?? 'Usuário'}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDateTime(comment.createdAt)}</span>
                  </div>
                  <div className="text-sm bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-wrap break-words relative">
                    {comment.content}
                    {(isOwn || canEdit) && (
                      <button type="button"
                        onClick={() => handleDelete(comment)}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-500 p-0.5 rounded">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {error && (
            <p className="text-xs text-rose-500 text-center">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {canEdit && (
          <div className="px-4 py-3 border-t shrink-0">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
                }}
                placeholder="Adicionar comentário… (Enter envia, Shift+Enter nova linha)"
                rows={3}
                className="w-full resize-none rounded-lg border bg-background text-sm px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
              <button type="button"
                onClick={handleSubmit}
                disabled={!draft.trim() || saving}
                className="absolute right-2 bottom-2 p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-40 transition-opacity hover:opacity-90">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        )}
      </div>
    </>
  )
}
