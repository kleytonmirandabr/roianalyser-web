/**
 * Drawer para criar/editar Contrato — substitui /contracts/new.
 */
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useCreateContract } from '@/features/contracts2/hooks/use-create-contract'
import {
  CONTRACT_STATUSES, CONTRACT_STATUS_LABELS, RENEWAL_TYPE_LABELS,
  type ContractStatus, type RenewalType,
} from '@/features/contracts2/types'
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
  fromOpportunityId?: string | null
  onSaved?: (id: string) => void
}

export function ContractFormSheet({ open, onClose, fromOpportunityId, onSaved }: Props) {
  const create = useCreateContract()

  const [name, setName] = useState('')
  const [status, setStatus] = useState<ContractStatus>('drafting')
  const [contractTypeKey, setContractTypeKey] = useState('')
  const [totalValue, setTotalValue] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [renewalType, setRenewalType] = useState<RenewalType>('manual')
  const [noticePeriodDays, setNoticePeriodDays] = useState('30')
  const [paymentTerms, setPaymentTerms] = useState('')

  useEffect(() => {
    if (!open) return
    setName(''); setStatus('drafting'); setContractTypeKey('')
    setTotalValue(''); setCurrency('BRL'); setStartDate(''); setEndDate('')
    setRenewalType('manual'); setNoticePeriodDays('30'); setPaymentTerms('')
  }, [open])

  const statusOptions = CONTRACT_STATUSES.map((s) => ({ value: s, label: CONTRACT_STATUS_LABELS[s] }))
  const renewalOptions = (Object.keys(RENEWAL_TYPE_LABELS) as RenewalType[]).map((k) => ({ value: k, label: RENEWAL_TYPE_LABELS[k] }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toastError(new Error('Informe o nome do contrato'))
    const valueNum = Number(totalValue)
    if (!Number.isFinite(valueNum) || valueNum <= 0) return toastError(new Error('Valor total deve ser positivo'))
    if (startDate && endDate && endDate < startDate) return toastError(new Error('Data fim não pode ser anterior ao início'))
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        status,
        opportunityId: fromOpportunityId || null,
        contractTypeKey: contractTypeKey.trim() || null,
        totalValue: valueNum,
        currency: currency.toUpperCase().slice(0, 3) || 'BRL',
        startDate: startDate || null,
        endDate: endDate || null,
        renewalType,
        noticePeriodDays: Number(noticePeriodDays) || 30,
        paymentTerms: paymentTerms.trim() || null,
      })
      toastSaved(`Contrato ${created.contractNumber || ''} criado`)
      onSaved?.(String(created.id))
      onClose()
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader><SheetTitle>Novo contrato</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit}>
          <SheetBody className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Status</Label>
                <Combobox options={statusOptions} value={status} onChange={(v) => setStatus(v as ContractStatus)} />
              </div>
              <div className="space-y-1"><Label>Tipo de contrato</Label>
                <Input value={contractTypeKey} onChange={(e) => setContractTypeKey(e.target.value)} placeholder="ex: prestacao_servicos" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Valor total *</Label>
                <Input type="number" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} required />
              </div>
              <div className="space-y-1"><Label>Moeda</Label>
                <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1"><Label>Fim</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Tipo de renovação</Label>
                <Combobox options={renewalOptions} value={renewalType} onChange={(v) => setRenewalType(v as RenewalType)} />
              </div>
              <div className="space-y-1"><Label>Aviso prévio (dias)</Label>
                <Input type="number" value={noticePeriodDays} onChange={(e) => setNoticePeriodDays(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1"><Label>Termos de pagamento</Label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
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
