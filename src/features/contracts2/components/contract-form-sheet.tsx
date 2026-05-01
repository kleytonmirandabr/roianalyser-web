/**
 * Drawer de criar Contrato (v3 — pré-fill do ROI aprovado).
 *
 * Quando aberto a partir de uma oportunidade COM ROI aprovado, recebe
 * `approvedRoiId` e pré-preenche:
 *   - Moeda (do ROI, read-only)
 *   - Valor total (= ROI metrics.totalRevenue, read-only)
 *   - Tempo de contrato (= roi.durationMonths, read-only)
 *
 * Usuário só preenche Nome, Início, Assinatura. Data Fim é auto-calculada:
 *   - Se Assinatura preenchida → Fim = Assinatura + duração
 *   - Senão se Início → Fim = Início + duração
 *   - Senão → vazia
 *
 * Quando contrato é avulso (sem ROI), todos os campos ficam editáveis.
 */
import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useCreateContract } from '@/features/contracts2/hooks/use-create-contract'
import {
  CONTRACT_STATUSES, CONTRACT_STATUS_LABELS, RENEWAL_TYPE_LABELS,
  type ContractStatus, type RenewalType,
} from '@/features/contracts2/types'
import { useRoiAnalysis } from '@/features/roi-analyses/hooks/use-roi-analysis'
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
  /** Pré-preenche a empresa quando vem da Oportunidade. */
  preselectCompanyId?: string | null
  /** Quando setado, puxa moeda+valor+duração do ROI e bloqueia esses campos. */
  approvedRoiId?: string | null
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

/** Adiciona N meses a uma data ISO (yyyy-mm-dd) e devolve nova ISO. */
function addMonthsIso(iso: string, months: number): string {
  if (!iso || !Number.isFinite(months) || months <= 0) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCMonth(dt.getUTCMonth() + months)
  return dt.toISOString().slice(0, 10)
}

const RoiBadge = () => (
  <span className="text-[10px] uppercase font-bold tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
    Do ROI
  </span>
)

export function ContractFormSheet({
  open, onClose, fromOpportunityId, preselectCompanyId, approvedRoiId, onSaved,
}: Props) {
  const create = useCreateContract()
  const companiesQ = useCompanies()
  const roiQ = useRoiAnalysis(approvedRoiId || undefined)
  const roi = roiQ.data?.item
  const roiMetrics = roiQ.data?.metrics

  const isFromRoi = !!approvedRoiId && !!roi

  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [status, setStatus] = useState<ContractStatus>('drafting')
  const [contractTypeKey, setContractTypeKey] = useState('')
  const [totalValue, setTotalValue] = useState<number | null>(null)
  const [currency, setCurrency] = useState('BRL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [signedDate, setSignedDate] = useState('')
  const [renewalType, setRenewalType] = useState<RenewalType>('manual')
  const [noticePeriodDays, setNoticePeriodDays] = useState('30')
  const [paymentTerms, setPaymentTerms] = useState('')
  /** Quando o usuário edita endDate manualmente, paramos de auto-calcular. */
  const [endDateManual, setEndDateManual] = useState(false)

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
    setSignedDate('')
    setRenewalType('manual')
    setNoticePeriodDays('30')
    setPaymentTerms('')
    setEndDateManual(false)
  }, [open, preselectCompanyId])

  // Quando o ROI carrega, sincronizar moeda + valor
  useEffect(() => {
    if (!open || !isFromRoi) return
    if (roi?.currency) setCurrency(roi.currency)
    if (roiMetrics?.totalRevenue != null && roiMetrics.totalRevenue > 0) {
      setTotalValue(roiMetrics.totalRevenue)
    }
    // Sugerir nome do contrato a partir do nome do ROI quando user ainda não digitou
    setName(prev => prev || (roi?.name ? `Contrato — ${roi.name}` : prev))
  }, [open, isFromRoi, roi?.currency, roi?.name, roiMetrics?.totalRevenue])

  const durationMonths = (roi?.durationMonths && roi.durationMonths > 0) ? roi.durationMonths : 12

  // Auto-calc endDate quando vier do ROI (ou pelo menos quando há duração)
  useEffect(() => {
    if (endDateManual) return
    if (!isFromRoi) return
    const base = signedDate || startDate
    if (!base) { setEndDate(''); return }
    setEndDate(addMonthsIso(base, durationMonths))
  }, [isFromRoi, signedDate, startDate, durationMonths, endDateManual])

  // UX: quando há ROI vinculado e usuário preenche Assinatura, default Início
  // = signedDate se startDate ainda vazio. Reduz fricção (tipicamente vigência
  // começa na assinatura).
  useEffect(() => {
    if (!isFromRoi) return
    if (!signedDate) return
    if (startDate) return
    setStartDate(signedDate)
  }, [isFromRoi, signedDate, startDate])

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
        approvedRoiId: approvedRoiId || null,
        contractTypeKey: contractTypeKey.trim() || null,
        totalValue,
        currency,
        startDate: startDate || null,
        endDate: endDate || null,
        signedDate: signedDate || null,
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
        <SheetHeader>
          <SheetTitle>Novo contrato</SheetTitle>
          {isFromRoi && (
            <p className="text-xs text-muted-foreground mt-1">
              Pré-preenchido com base no ROI aprovado <strong>{roi?.name}</strong> v{roi?.version}.
            </p>
          )}
        </SheetHeader>
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
                <Label className="flex items-center gap-2">
                  Moeda <span className="text-rose-600">*</span>
                  {isFromRoi && <RoiBadge />}
                </Label>
                <Combobox
                  options={SUPPORTED_CURRENCIES}
                  value={currency}
                  onChange={setCurrency}
                  disabled={isFromRoi}
                />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  Valor total <span className="text-rose-600">*</span>
                  {isFromRoi && <RoiBadge />}
                </Label>
                <CurrencyInput
                  value={totalValue}
                  currency={currency}
                  onChange={setTotalValue}
                  placeholder="0,00"
                  disabled={isFromRoi}
                />
              </div>
            </div>

            {isFromRoi && (
              <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between">
                <span>
                  <strong>Tempo de contrato:</strong> {durationMonths} meses (do ROI)
                </span>
                <span className="text-blue-600 dark:text-blue-500">
                  A Data Fim é calculada automaticamente.
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Assinatura</Label>
                <Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  Fim
                  {isFromRoi && !endDateManual && <RoiBadge />}
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setEndDateManual(true) }}
                  className={isFromRoi && !endDateManual ? 'opacity-70' : undefined}
                />
                {isFromRoi && !endDateManual && (
                  <p className="text-[10px] text-muted-foreground">
                    {signedDate ? 'Assinatura' : startDate ? 'Início' : '—'} + {durationMonths} meses
                  </p>
                )}
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
