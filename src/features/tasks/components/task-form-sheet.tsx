/**
 * Drawer reutilizável para criar/editar Tarefa (Sprint #211).
 *
 * Usado em:
 *   - Kanban / Board card (botão "+")
 *   - OpportunityViewSheet (header "+ Tarefa")
 *   - Página /tasks (botão "Criar tarefa")
 *
 * Quando `initial` é passado entra em modo edição.
 * Quando `entityType`+`entityId` são passados, pré-preenche o vínculo
 * (botão do card kanban → entityType='opportunity', entityId=oppId).
 */
import { Save, Trash2, Calendar, ListTodo, Repeat, Bell, Tag, Briefcase } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useTaskTemplates } from '@/features/task-templates/hooks/use-task-templates'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/use-tasks'
import type { Task, TaskPriority, TaskStatus } from '../types'
import { toastError, toastSaved, toastDeleted } from '@/shared/lib/toasts'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Button } from '@/shared/ui/button'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/shared/ui/sheet'

const PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

const STATUSES: Array<{ value: TaskStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
]

const REMINDERS = [
  { value: '', label: 'Sem lembrete' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '1440', label: '1 dia antes' },
  { value: '2880', label: '2 dias antes' },
  { value: '10080', label: '1 semana antes' },
]

type RecurrenceUnit = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

interface Props {
  open: boolean
  onClose: () => void
  initial?: Task | null
  entityType?: string
  entityId?: string
  /** Se passado, força readonly do vínculo (não deixa mudar entity). */
  lockEntity?: boolean
  onSaved?: (task: Task) => void
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: any }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b pb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ''
  // Convert ISO string to "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInputValue(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function TaskFormSheet({
  open, onClose, initial, entityType, entityId, lockEntity, onSaved,
}: Props) {
  const { user } = useAuth()
  const create = useCreateTask()
  const update = useUpdateTask(initial?.id ?? null)
  const del = useDeleteTask()
  const { data: templates = [] } = useTaskTemplates()
  const { data: opps = [] } = useOpportunities()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>

  const isEditing = !!initial?.id

  const [title, setTitle] = useState('')
  const [taskTemplateId, setTaskTemplateId] = useState('')
  const [description, setDescription] = useState('')
  const [dueAtLocal, setDueAtLocal] = useState('')
  const [reminderMinutes, setReminderMinutes] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [status, setStatus] = useState<TaskStatus>('pending')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>('NONE')
  const [recurrenceCount, setRecurrenceCount] = useState('4')
  const [recurrenceUntil, setRecurrenceUntil] = useState('')
  const [boundEntityType, setBoundEntityType] = useState('opportunity')
  const [boundEntityId, setBoundEntityId] = useState('')

  // Reset / hidrata sempre que abre.
  useEffect(() => {
    if (!open) return
    if (initial) {
      setTitle(initial.title || '')
      setTaskTemplateId(initial.taskTemplateId || '')
      setDescription(initial.description || '')
      setDueAtLocal(toLocalInputValue(initial.dueAt))
      setReminderMinutes(initial.reminderMinutesBefore != null ? String(initial.reminderMinutesBefore) : '')
      setResponsibleId(initial.responsibleIds?.[0] || '')
      setStatus(initial.status || 'pending')
      setPriority(initial.priority || 'medium')
      // Parse recurrence rule "DAILY:N", "WEEKLY:N", "MONTHLY:N"
      if (initial.recurrenceRule) {
        const [unit, n] = initial.recurrenceRule.split(':')
        if (['DAILY', 'WEEKLY', 'MONTHLY'].includes(unit)) {
          setRecurrenceUnit(unit as RecurrenceUnit)
          setRecurrenceCount(n || '4')
        } else {
          setRecurrenceUnit('NONE')
        }
      } else {
        setRecurrenceUnit('NONE')
      }
      setRecurrenceUntil(initial.recurrenceUntil || '')
      setBoundEntityType(initial.entityType || 'opportunity')
      setBoundEntityId(String(initial.entityId || ''))
    } else {
      setTitle('')
      setTaskTemplateId('')
      setDescription('')
      setDueAtLocal('')
      setReminderMinutes('')
      setResponsibleId(user?.id ? String(user.id) : '')
      setStatus('pending')
      setPriority('medium')
      setRecurrenceUnit('NONE')
      setRecurrenceCount('4')
      setRecurrenceUntil('')
      setBoundEntityType(entityType || 'opportunity')
      setBoundEntityId(entityId ? String(entityId) : '')
    }
  }, [open, initial, entityType, entityId, user?.id])

  // Auto-fill title quando seleciona template (só se title ainda vazio).
  useEffect(() => {
    if (!taskTemplateId) return
    const tpl = templates.find(t => String(t.id) === String(taskTemplateId))
    if (tpl && !title.trim()) setTitle(tpl.name)
  }, [taskTemplateId]) // eslint-disable-line react-hooks/exhaustive-deps

  const userOptions = useMemo(() => {
    return tenantUsers
      .filter(u => !!u.id)
      .map(u => ({ value: String(u.id), label: u.name || u.email || String(u.id) }))
  }, [tenantUsers])

  const templateOptions = useMemo(() => {
    return [{ value: '', label: '— sem tipo —' }].concat(
      (templates || [])
        .filter(t => t.active)
        .map(t => ({ value: String(t.id), label: t.name }))
    )
  }, [templates])

  const oppOptions = useMemo(() => {
    return (opps || [])
      .filter(o => !o.deletedAt)
      .map(o => ({
        value: String(o.id),
        label: o.name || `#${o.id}`,
        hint: `#${o.id}`,
      }))
  }, [opps])

  function buildRecurrenceRule(): string | null {
    if (recurrenceUnit === 'NONE') return null
    const n = parseInt(recurrenceCount, 10)
    if (!Number.isFinite(n) || n <= 0) return null
    return `${recurrenceUnit}:${Math.min(n, 50)}`
  }

  async function handleSave() {
    if (!title.trim()) {
      toastError('Informe um título.')
      return
    }
    if (!boundEntityId) {
      toastError('Selecione uma oportunidade.')
      return
    }
    const rule = buildRecurrenceRule()
    const payload = {
      entityType: boundEntityType,
      entityId: boundEntityId,
      title: title.trim(),
      description: description.trim() || null,
      taskTemplateId: taskTemplateId || null,
      dueAt: fromLocalInputValue(dueAtLocal),
      responsibleIds: responsibleId ? [responsibleId] : [],
      status,
      priority,
      reminderMinutesBefore: reminderMinutes ? parseInt(reminderMinutes, 10) : null,
      recurrenceRule: rule,
      recurrenceUntil: recurrenceUntil || null,
    }
    try {
      if (isEditing && initial?.id) {
        const t = await update.mutateAsync(payload)
        toastSaved()
        onSaved?.(t)
      } else {
        const r = await create.mutateAsync(payload)
        const respUser = tenantUsers.find(u => String(u.id) === String(responsibleId))
        const respLabel = respUser?.name || respUser?.email
        const isSelf = responsibleId === String(user?.id || '')
        if (r.recurrenceCount && r.recurrenceCount > 1) {
          toastSaved(`Tarefa criada (${r.recurrenceCount} ocorrencias)`)
        } else if (respLabel && !isSelf) {
          toastSaved(`Tarefa criada para ${respLabel} - email enviado`)
        } else {
          toastSaved('Tarefa criada')
        }
        onSaved?.(r.item)
      }
      onClose()
    } catch (err: any) {
      toastError(err?.message || 'Falha ao salvar tarefa.')
    }
  }

  async function handleDelete() {
    if (!isEditing || !initial?.id) return
    const ok = await confirm({
      title: 'Excluir tarefa?',
      description: 'Quem foi notificado vai receber um cancelamento de calendário. Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(initial.id)
      toastDeleted('Tarefa excluída')
      onClose()
    } catch (err: any) {
      toastError(err?.message || 'Falha ao excluir tarefa.')
    }
  }

  const canDelete = isEditing && (
    user?.isMaster === true ||
    (initial?.createdBy && String(initial.createdBy) === String(user?.id || ''))
  )

  const saving = create.isPending || update.isPending || del.isPending

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar tarefa' : 'Nova tarefa'}</SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-5">
          <Section icon={ListTodo} title="Identificação">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="task-tpl">Tipo de tarefa</Label>
                <Combobox
                  id="task-tpl"
                  options={templateOptions}
                  value={taskTemplateId}
                  onChange={setTaskTemplateId}
                  placeholder="Selecione um tipo (Ligar, Reunião...)"
                />
              </div>
              <div>
                <Label htmlFor="task-title">Título *</Label>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ligar para a Acme sobre proposta"
                  required
                />
              </div>
              <div>
                <Label htmlFor="task-desc">Descrição</Label>
                <textarea
                  id="task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Detalhes adicionais, contexto, links..."
                />
              </div>
            </div>
          </Section>

          <Section icon={Calendar} title="Quando">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="task-due">Data e hora</Label>
                <Input
                  id="task-due"
                  type="datetime-local"
                  value={dueAtLocal}
                  onChange={(e) => setDueAtLocal(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="task-reminder">Lembrete</Label>
                <Combobox
                  id="task-reminder"
                  options={REMINDERS}
                  value={reminderMinutes}
                  onChange={setReminderMinutes}
                  placeholder="Sem lembrete"
                />
              </div>
            </div>
          </Section>

          <Section icon={Tag} title="Atribuição">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="task-resp">Responsável</Label>
                <Combobox
                  id="task-resp"
                  options={userOptions}
                  value={responsibleId}
                  onChange={setResponsibleId}
                  placeholder="Selecione um usuário"
                />
              </div>
              <div>
                <Label htmlFor="task-priority">Prioridade</Label>
                <Combobox
                  id="task-priority"
                  options={PRIORITIES.map(p => ({ value: p.value, label: p.label }))}
                  value={priority}
                  onChange={(v) => setPriority(v as TaskPriority)}
                />
              </div>
              {isEditing && (
                <div>
                  <Label htmlFor="task-status">Status</Label>
                  <Combobox
                    id="task-status"
                    options={STATUSES.map(s => ({ value: s.value, label: s.label }))}
                    value={status}
                    onChange={(v) => setStatus(v as TaskStatus)}
                  />
                </div>
              )}
            </div>
          </Section>

          <Section icon={Repeat} title="Recorrência">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="task-rec-unit">Repetir</Label>
                <Combobox
                  id="task-rec-unit"
                  options={[
                    { value: 'NONE', label: 'Não repetir' },
                    { value: 'DAILY', label: 'Diariamente' },
                    { value: 'WEEKLY', label: 'Semanalmente' },
                    { value: 'MONTHLY', label: 'Mensalmente' },
                  ]}
                  value={recurrenceUnit}
                  onChange={(v) => setRecurrenceUnit(v as RecurrenceUnit)}
                />
              </div>
              {recurrenceUnit !== 'NONE' && (
                <>
                  <div>
                    <Label htmlFor="task-rec-count">Quantas ocorrências</Label>
                    <Input
                      id="task-rec-count"
                      type="number"
                      min={1}
                      max={50}
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="task-rec-until">Até (opcional)</Label>
                    <Input
                      id="task-rec-until"
                      type="date"
                      value={recurrenceUntil}
                      onChange={(e) => setRecurrenceUntil(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            {recurrenceUnit !== 'NONE' && (
              <p className="text-xs text-muted-foreground">
                <Bell className="inline h-3 w-3 mr-1" />
                Vai gerar até 50 ocorrências automaticamente. Cada uma vira uma tarefa independente.
              </p>
            )}
          </Section>

          {!lockEntity && (
            <Section icon={Briefcase} title="Vínculo *">
              <div className="space-y-2">
                <Label htmlFor="task-opp">Oportunidade *</Label>
                <Combobox
                  id="task-opp"
                  options={oppOptions}
                  value={boundEntityType === 'opportunity' ? boundEntityId : ''}
                  onChange={(v) => { setBoundEntityType('opportunity'); setBoundEntityId(v) }}
                  placeholder={oppOptions.length ? 'Selecione uma oportunidade...' : 'Nenhuma oportunidade disponível'}
                  emptyText="Nenhuma oportunidade encontrada"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  A tarefa precisa estar vinculada a uma oportunidade (cliente, valor, status).
                </p>
              </div>
            </Section>
          )}
        </SheetBody>

        <SheetFooter className="sm:justify-between">
          {canDelete ? (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-1" />
              {del.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
