/**
 * Cronograma de Milestones do projeto (Sprint A.2).
 *
 * Timeline vertical com bolinhas (verde concluído, cinza pendente, amber
 * overdue, rose cancelado). Permite criar, editar (data/título), marcar
 * como concluído, excluir.
 */
import { CheckCircle2, Circle, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

import {
  MILESTONE_STATUS_LABELS,
  type MilestoneStatus,
  type ProjectMilestone,
} from '@/features/projects2/milestones-types'
import {
  useCreateMilestone,
  useDeleteMilestone,
  useProjectMilestones,
  useUpdateMilestone,
} from '@/features/projects2/hooks/use-project-milestones'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function isOverdue(m: ProjectMilestone): boolean {
  if (m.status !== 'pending') return false
  if (!m.plannedDate) return false
  return m.plannedDate < new Date().toISOString().slice(0, 10)
}

export function MilestonesCard({ projectId }: { projectId: string | undefined }) {
  const list = useProjectMilestones(projectId)
  const create = useCreateMilestone(projectId)
  const update = useUpdateMilestone(projectId)
  const remove = useDeleteMilestone(projectId)

  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')

  const items = list.data || []
  const total = items.length
  const completed = items.filter(i => i.status === 'completed').length
  const overdueCount = items.filter(isOverdue).length

  async function handleAdd() {
    if (!projectId || !newTitle.trim()) return
    try {
      await create.mutateAsync({
        title: newTitle.trim(),
        plannedDate: newDate || null,
        status: 'pending',
      })
      toastSaved('Marco criado')
      setNewTitle('')
      setNewDate('')
      setAdding(false)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function toggleComplete(m: ProjectMilestone) {
    if (!projectId) return
    const newStatus: MilestoneStatus = m.status === 'completed' ? 'pending' : 'completed'
    try {
      await update.mutateAsync({
        id: m.id,
        patch: {
          status: newStatus,
          // ao virar pending, limpa data de conclusão
          completedDate: newStatus === 'pending' ? null : undefined,
        },
      })
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDelete(m: ProjectMilestone) {
    if (!projectId) return
    const ok = await confirm({
      title: 'Remover marco',
      description: `Remover "${m.title}"?`,
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(m.id)
      toastDeleted('Marco removido')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cronograma de marcos ({total})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completed} de {total} concluídos
            {overdueCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> {overdueCount} atrasado{overdueCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo marco
        </Button>
      </div>

      {adding && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex.: Kickoff, Entrega da fase 1, Aprovação do cliente..."
                autoFocus
              />
            </div>
            <div>
              <Label>Data planejada</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setAdding(false); setNewTitle(''); setNewDate('') }}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newTitle.trim() || create.isPending}>
              {create.isPending ? 'Criando...' : 'Criar marco'}
            </Button>
          </div>
        </div>
      )}

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">Nenhum marco cadastrado.</div>
      ) : (
        <ol className="relative border-l-2 border-border pl-6 space-y-3">
          {items.map((m) => {
            const overdue = isOverdue(m)
            const dotColor = m.status === 'completed' ? 'bg-emerald-500'
              : m.status === 'cancelled' ? 'bg-rose-500'
              : overdue ? 'bg-amber-500'
              : 'bg-muted-foreground/40'
            const Icon = m.status === 'completed' ? CheckCircle2 : Circle
            const statusOptions = (Object.entries(MILESTONE_STATUS_LABELS) as Array<[MilestoneStatus, string]>).map(
              ([value, label]) => ({ value, label }),
            )
            return (
              <li key={m.id} className="relative">
                <span className={`absolute -left-[31px] top-2 h-3.5 w-3.5 rounded-full ring-4 ring-background ${dotColor}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => toggleComplete(m)}
                        className="text-muted-foreground hover:text-emerald-600 transition-colors"
                        title={m.status === 'completed' ? 'Reabrir marco' : 'Marcar concluído'}
                      >
                        <Icon className={`h-4 w-4 ${m.status === 'completed' ? 'text-emerald-600' : ''}`} />
                      </button>
                      <span className={`text-sm font-medium ${m.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                        {m.title}
                      </span>
                      {overdue && (
                        <span className="text-[10px] uppercase font-bold tracking-wide bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                          Atrasado
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 mt-1">
                      {m.plannedDate && <span>Planejado: <strong>{fmtDate(m.plannedDate)}</strong></span>}
                      {m.completedDate && <span className="text-emerald-700 dark:text-emerald-400">Concluído: <strong>{fmtDate(m.completedDate)}</strong></span>}
                      <div className="w-32">
                        <Combobox
                          options={statusOptions}
                          value={m.status}
                          onChange={(v) => {
                            const ns = v as MilestoneStatus
                            update.mutateAsync({
                              id: m.id,
                              patch: { status: ns, completedDate: ns === 'pending' ? null : undefined },
                            }).catch(err => toastError(`Erro: ${(err as Error).message}`))
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(m)} disabled={remove.isPending} title="Remover">
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {/* Mini barra de progresso */}
      {total > 0 && (
        <div className="space-y-1 pt-2 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso por marcos</span>
            <span className="font-semibold tabular-nums">{Math.round((completed / total) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(completed / total) * 100}%` }} />
          </div>
        </div>
      )}
    </Card>
  )
}
