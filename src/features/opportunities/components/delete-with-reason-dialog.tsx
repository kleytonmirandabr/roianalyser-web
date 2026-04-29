/**
 * Diálogo de motivo de exclusão para Oportunidades.
 * Usado tanto em DELETE single quanto em bulk-delete.
 *
 * O motivo é obrigatório (Sprint #198) — toda exclusão é audited.
 */
import { useEffect, useState } from 'react'

import { useOpportunityDeletionReasons } from '@/features/opportunity-deletion-reasons/hooks/use-opportunity-deletion-reasons'
import { Button } from '@/shared/ui/button'
import { Combobox } from '@/shared/ui/combobox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'

interface Props {
  open: boolean
  onClose: () => void
  count: number
  onConfirm: (input: { reasonId: string; note: string | null }) => Promise<void> | void
  pending?: boolean
}

export function DeleteWithReasonDialog({ open, onClose, count, onConfirm, pending }: Props) {
  const { data: reasons = [], isLoading } = useOpportunityDeletionReasons()
  const [reasonId, setReasonId] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) {
      setReasonId('')
      setNote('')
    }
  }, [open])

  const reasonOptions = [
    { value: '', label: '— selecione um motivo —' },
    ...reasons.filter(r => r.active).map(r => ({ value: String(r.id), label: r.name })),
  ]

  async function handleConfirm() {
    if (!reasonId) return
    await onConfirm({ reasonId, note: note.trim() || null })
  }

  const title = count === 1
    ? 'Excluir oportunidade'
    : `Excluir ${count} oportunidades`

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Toda exclusão é registrada em auditoria. Selecione o motivo:
          </p>
          <div className="space-y-1">
            <Label>Motivo *</Label>
            <Combobox
              options={reasonOptions}
              value={reasonId}
              onChange={setReasonId}
              placeholder={isLoading ? 'Carregando…' : 'Selecione…'}
            />
          </div>
          <div className="space-y-1">
            <Label>Observação (opcional)</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalhe adicional (até 500 caracteres)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reasonId || pending}
            onClick={handleConfirm}
          >
            {pending ? 'Excluindo…' : (count === 1 ? 'Excluir' : `Excluir ${count}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
