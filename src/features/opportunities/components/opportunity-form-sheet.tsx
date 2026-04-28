/**
 * Drawer para criar/editar oportunidade — substitui /opportunities/new.
 */
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useCreateOpportunity } from '@/features/opportunities/hooks/use-create-opportunity'
import { useUpdateOpportunity } from '@/features/opportunities/hooks/use-update-opportunity'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { useOpportunityTypes } from '@/features/opportunity-types/hooks/use-opportunity-types'
import type { Opportunity } from '@/features/opportunities/types'
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
  initial?: Opportunity | null
  onSaved?: (id: string) => void
}

export function OpportunityFormSheet({ open, onClose, initial, onSaved }: Props) {
  const create = useCreateOpportunity()
  const update = useUpdateOpportunity(initial?.id)
  const { data: statuses = [] } = useOpportunityStatuses()
  const { data: types = [] } = useOpportunityTypes()

  const [name, setName] = useState('')
  const [statusId, setStatusId] = useState('')
  const [opportunityTypeId, setOpportunityTypeId] = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name ?? '')
      setStatusId(initial.statusId ?? '')
      setOpportunityTypeId(initial.opportunityTypeId ?? '')
      setExpectedCloseDate(initial.expectedCloseDate ?? '')
      setEstimatedValue(initial.estimatedValue != null ? String(initial.estimatedValue) : '')
      setCurrency(initial.currency ?? 'BRL')
      setDescription(initial.description ?? '')
    } else {
      setName(''); setStatusId(''); setOpportunityTypeId('')
      setExpectedCloseDate(''); setEstimatedValue(''); setCurrency('BRL')
      setDescription('')
    }
  }, [open, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toastError(new Error('Informe o nome da oportunidade'))
    try {
      const payload = {
        name: name.trim(),
        statusId: statusId || null,
        opportunityTypeId: opportunityTypeId || null,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        currency: currency.toUpperCase().slice(0, 3) || 'BRL',
        expectedCloseDate: expectedCloseDate || null,
        description: description.trim() || null,
      }
      const result = initial?.id
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload)
      toastSaved(initial?.id ? 'Oportunidade atualizada' : 'Oportunidade criada')
      onSaved?.(String(result.id))
      onClose()
    } catch (err) {
      toastError(err)
    }
  }

  const statusOptions = statuses.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))
  const typeOptions = types.filter((tp) => tp.active).map((tp) => ({ value: tp.id, label: tp.name }))

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{initial?.id ? 'Editar oportunidade' : 'Nova oportunidade'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit}>
          <SheetBody className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Combobox options={statusOptions} value={statusId} onChange={setStatusId} placeholder="Selecione..." />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Combobox options={typeOptions} value={opportunityTypeId} onChange={setOpportunityTypeId} placeholder="Selecione..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor estimado</Label>
                <Input type="number" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Moeda</Label>
                <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Fechamento previsto</Label>
              <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              <Save className="h-4 w-4 mr-2" /> {initial?.id ? 'Salvar' : 'Criar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
