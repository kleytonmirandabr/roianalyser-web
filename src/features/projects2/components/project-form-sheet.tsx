/**
 * Drawer para criar/editar Projeto novo — substitui /projects/new.
 */
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useCreateProject2 } from '@/features/projects2/hooks/use-create-project'
import {
  PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus,
} from '@/features/projects2/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/shared/ui/sheet'

interface Props {
  open: boolean
  onClose: () => void
  fromContractId?: string | null
  fromOpportunityId?: string | null
  onSaved?: (id: string) => void
}

export function ProjectFormSheet({ open, onClose, fromContractId, fromOpportunityId, onSaved }: Props) {
  const create = useCreateProject2()

  const [name, setName] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [budget, setBudget] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    setName(''); setStatus('planning'); setPlannedStart('')
    setPlannedEnd(''); setBudget(''); setDescription('')
  }, [open])

  const statusOptions = PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toastError(new Error('Nome é obrigatório'))
    if (plannedStart && plannedEnd && plannedEnd < plannedStart) return toastError(new Error('Data fim não pode ser anterior ao início'))
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        status,
        contractId: fromContractId || null,
        opportunityId: fromOpportunityId || null,
        plannedStart: plannedStart || null,
        plannedEnd: plannedEnd || null,
        budget: budget ? Number(budget) : null,
        currency: 'BRL',
        description: description.trim() || null,
      })
      toastSaved(`Projeto ${created.projectCode || ''} criado`)
      onSaved?.(String(created.id))
      onClose()
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader><SheetTitle>Novo projeto</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit}>
          <SheetBody className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Combobox options={statusOptions} value={status} onChange={(v) => setStatus(v as ProjectStatus)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Início planejado</Label>
                <Input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
              </div>
              <div className="space-y-1"><Label>Fim planejado</Label>
                <Input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Orçamento</Label>
              <Input type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              <Save className="h-4 w-4 mr-2" /> Criar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
