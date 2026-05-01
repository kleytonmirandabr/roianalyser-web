/**
 * Drawer de criar Contrato (refatorado).
 *
 * - Empresa (Combobox, obrigatório) — lista companies do tenant ativo
 * - Moeda (Combobox com lista fechada BRL/USD/EUR/GBP/ARS/CLP/MXN)
 * - Valor (CurrencyInput com máscara baseada na moeda)
 * - Datas, renovação, condições de pagamento — iguais à versão anterior
 */
import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useCreateContract } from '@/features/contracts2/hooks/use-create-contract'
import {
  CONTRACT_STATUSES, CONTRACT_STATUS_LABELS, RENEWAL_TYPE_LABELS,
  type ContractStatus, type RenewalType,
} from '@/features/contracts2/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Combobox } from '@/shared/ui/combobox'
import { CurrencyInput } from '@/shared/ui/currency-input'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/shared/ui/sheet'

interface Props {
  open: boolean
  onClose: () => void
  fromOpportunityId?: string | null
  /** Pré-preenche a empresa quando vem da Oportunidade (que já tem companyId). */
  preselectCompanyId?: string | null
  onSaved?: (id: string) => void
}

const SUPPORTED_CURRENCIES: Array<{ value: string; label: string }> = [
  { value: 'BRL', label: 'BRL — Real (R$)' },
  { value: 'USD', label: 'USD — Dólar americano (US$)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — Libra esterlina (£)' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
]

export function ContractFormSheet({ open, onClose, fromOpportunityId, preselectCompanyId, onSaved }: Props) {
  const create = useCreateContract()
  const companiesQ = useCompanies()

  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [status, setStatus] = useState<ContractStatus>('drafting')
  const [contractTypeKey, setContractTypeKey] = useState('')
  const [totalValue, setTotalValue] = useState<number | null>(null)
  const [currency, setCurrency] = useState('BRL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [renewalType, setRenewalType] = useState<RenewalType>('manual')
  const [noticePeriodDays, setNoticePeriodDays] = useState('30')
  const [paymentTerms, setPaymentTerms] = useState('')

  // Reset ao abrir
  useEffect(() => {
    if (!open) return
    setName('')
    setCompanyId(preselectCompanyId || '')
    setStatus('drafting')
    setContractTypeKey('')
    setTotalValue(null)
    setCurrency('BRL')
    setStartDate('')
    setEndDate('')
    setRenewalType('manual')
    setNoticePeriodDays('30')
    setPaymentTerms('')
  }, [open, preselectCompanyId])

  const companies = (companiesQ.data || []).filter((c: any) => !c.deletedAt)
  const companyOptions = useMemo(
    () =>
      companies.map((c: any) => ({
        value: String(c.id),
        label: c.name + (c.cnpj ? ` · ${c.cnpj}` : ''),
      })),
    [companies],
  )

  const statusOptions = CONTRACT_STATUSES.map((s) => ({ value: s, label: CONTRACT_STATUS_LABELS[s] }))
  const renewalOptions = (Object.keys(RENEWAL_TYPE_LABELS) as RenewalType[]).map((k) => ({
    value: k,
    label: RENEWAL_TYPE_LABELS[k],
  }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toastError('Informe o nome do contrato')
    if (!companyId) return toastError('Selecione a empresa contratante')
    if (!currency || !SUPPORTED_CURRENCIES.some(c => c.value === currency)) {
      return toastError('Selecione a moeda do contrato')
    }
    if (totalValue == null || !Number.isFinite(totalValue) || totalValue <= 0) {
      return toastError('Valor total é obrigatório e deve ser positivo')
    }
    if (startDate && endDate && endDate < startDate) {
      return toastError('Data fim não pode ser anterior ao início')
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        companyId,
        status,
        opportunityId: fromOpportunityId || null,
        contractTypeKey: contractTypeKey.trim() || null,
        totalValue,
        currency,
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
              <Label>Nome <span className="text-rose-600">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </div>

            <div className="space-y-1">
              <Label>Empresa contratante <span className="text-rose-600">*</span></Label>
              {companiesQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando empresas...</div>
              ) : companies.length === 0 ? (
                <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
                  Nenhuma empresa cadastrada. Cadastre uma em <strong>Cadastros CRM → Empresas</strong> antes de criar o contrato.
                </div>
              ) : (
                <Combobox
                  options={companyOptions}
                  value={companyId}
                  onChange={(v) => setCompanyId(v)}
                  placeholder="Selecione a empresa..."
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Combobox
                  options={statusOptions}
                  value={status}
                  onChange={(v) => setStatus(v as ContractStatus)}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo de contrato</Label>
                <Input
                  value={contractTypeKey}
                  onChange={(e) => setContractTypeKey(e.target.value)}
                  placeholder="ex: prestacao_servicos"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Moeda <span className="text-rose-600">*</span></Label>
                <Combobox options={SUPPORTED_CURRENCIES} value={currency} onChange={setCurrency} />
              </div>
              <div className="space-y-1">
                <Label>Valor total <span className="text-rose-600">*</span></Label>
                <CurrencyInput
                  value={totalValue}
                  currency={currency}
                  onChange={setTotalValue}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fim</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de renovação</Label>
                <Combobox
                  options={renewalOptions}
                  value={renewalType}
                  onChange={(v) => setRenewalType(v as RenewalType)}
                />
              </div>
              <div className="space-y-1">
                <Label>Aviso prévio (dias)</Label>
                <Input
                  type="number"
                  value={noticePeriodDays}
                  onChange={(e) => setNoticePeriodDays(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Termos de pagamento</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || companies.length === 0}>
              <Save className="h-4 w-4 mr-2" /> Criar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
