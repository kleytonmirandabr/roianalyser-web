/**
 * Kanban view do projeto (Phase 3 P.7).
 *
 * 5 colunas correspondentes aos status (planning/in_progress/waiting/done/cancelled).
 * Drag-and-drop nativo HTML5 para mover tarefas entre colunas (atualiza status).
 *
 * Mostra apenas tarefas (kind=task), nao groups nem subtasks. Cards levam:
 * titulo + prazo + responsaveis (avatars) + progresso.
 */
import { Calendar, UserCircle2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import {
  MILESTONE_STATUS_COLORS, MILESTONE_STATUS_LABELS,
  type MilestoneStatus, type ProjectMilestone,
} from '@/features/projects2/milestones-types'
import { useUpdateMilestone } from '@/features/projects2/hooks/use-project-milestones'
import { toastError } from '@/shared/lib/toasts'

interface UserMini { id: string; name: string }

interface Props {
  tasks: ProjectMilestone[]
  projectId: string | undefined
  canEdit: boolean
}

const COLS: MilestoneStatus[] = ['planning', 'in_progress', 'waiting', 'stuck', 'done', 'cancelled']

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch { return iso }
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

function Avatars({ ids, users }: { ids: string[]; users: UserMini[] }) {
  if (!ids.length) return <UserCircle2 className="h-5 w-5 text-muted-foreground/40" />
  const list = ids.map(id => users.find(u => u.id === id)).filter(Boolean) as UserMini[]
  return (
    <div className="flex -space-x-1">
      {list.slice(0, 3).map(u => (
        <div
          key={u.id}
          title={u.name}
          className="h-5 w-5 rounded-full ring-2 ring-background bg-primary/15 text-primary flex items-center justify-center text-[9px] font-semibold"
        >
          {initials(u.name)}
        </div>
      ))}
      {list.length > 3 && (
        <div className="h-5 w-5 rounded-full ring-2 ring-background bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-semibold">
          +{list.length - 3}
        </div>
      )}
    </div>
  )
}

export function TasksKanbanView({ tasks, projectId, canEdit }: Props) {
  const update = useUpdateMilestone(projectId)
  const appState = useAppState()
  const users: UserMini[] = ((appState.data?.users || []) as Array<{ id: string; name?: string; email?: string }>)
    .map(u => ({ id: String(u.id), name: u.name || u.email || `User #${u.id}` }))

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<MilestoneStatus | null>(null)

  // Filtra apenas tarefas (nao groups nem subtasks)
  const onlyTasks = useMemo(() => tasks.filter(t => t.kind === 'task'), [tasks])
  const byStatus = useMemo(() => {
    const map: Record<MilestoneStatus, ProjectMilestone[]> = {
      planning: [], in_progress: [], waiting: [], done: [], stuck: [], cancelled: [],
    }
    for (const t of onlyTasks) { if (map[t.status]) map[t.status].push(t) }
    return map
  }, [onlyTasks])

  function handleDragStart(taskId: string) {
    if (!canEdit) return
    setDraggingId(taskId)
  }
  function handleDragOver(e: React.DragEvent, col: MilestoneStatus) {
    e.preventDefault()
    if (!canEdit) return
    setDragOverCol(col)
  }
  async function handleDrop(col: MilestoneStatus) {
    if (!canEdit || !draggingId) return
    const task = onlyTasks.find(t => t.id === draggingId)
    setDraggingId(null); setDragOverCol(null)
    if (!task || task.status === col) return
    try {
      await update.mutateAsync({
        id: draggingId,
        patch: { status: col, completedDate: col !== 'done' ? null : undefined },
      })
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  if (onlyTasks.length === 0) {
    return (
      <div className="px-6 py-8 text-sm text-muted-foreground italic">
        Nenhuma tarefa no projeto. Crie tarefas na visao Lista.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto px-4 py-3">
      <div className="flex gap-3 min-w-max">
        {COLS.map((col) => {
          const items = byStatus[col]
          const isDropTarget = dragOverCol === col && draggingId !== null
          return (
            <div
              key={col}
              className={`w-64 flex-shrink-0 rounded-lg border bg-muted/20 ${isDropTarget ? 'ring-2 ring-primary' : ''}`}
              onDragOver={(e) => handleDragOver(e, col)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col)}
            >
              <div className={`px-3 py-2 border-b font-semibold text-xs uppercase tracking-wide ${MILESTONE_STATUS_COLORS[col]}`}>
                {MILESTONE_STATUS_LABELS[col]} <span className="opacity-70">({items.length})</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {items.map((t) => (
                  <div
                    key={t.id}
                    draggable={canEdit}
                    onDragStart={() => handleDragStart(t.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                    className={`rounded border bg-card p-2.5 shadow-sm cursor-grab active:cursor-grabbing ${draggingId === t.id ? 'opacity-50' : ''}`}
                  >
                    <div className={`text-sm font-medium ${t.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                      {t.title}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {t.plannedDate && (
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(t.plannedDate)}</span>
                        )}
                        {t.progressPct !== null && t.progressPct !== undefined && t.progressPct > 0 && (
                          <span className="tabular-nums">{t.progressPct}%</span>
                        )}
                      </div>
                      <Avatars ids={t.responsibleIds} users={users} />
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-[11px] text-muted-foreground italic text-center py-3">
                    {canEdit ? 'Arraste tarefas aqui' : 'Vazio'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
